import { ApiError, ensure } from './errors';
import {
  CreateJobInput,
  Job,
  JobAggregateReport,
  JobDistribution,
  JobDuration,
  JobPriority,
  JobStatus,
  JobTimelineEntry,
  JobTempo,
  JobTempoSteps,
  JobWorkerStatus
} from './types';
import { createMockJob, getAvailableFeatures, getMockJobs } from './mockData';
import { getAppConfig } from '../config/env';
import { getDefaultFeatureCatalog } from '../domain/features';
import {
  getRedMeshApiService,
  JobSpecs,
  LaunchTestRequest,
  GetJobStatusResponse
} from '../services/redmeshApi';

function coerceArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value as T];
}

function extractTimeline(raw: any): JobTimelineEntry[] {
  const source = coerceArray<any>(raw?.timeline ?? raw?.events);
  const mapped = source
    .filter((entry) => entry)
    .map((entry) => {
      const label = entry.label || entry.event || entry.state || 'Status changed';
      const ts = entry.at || entry.timestamp || entry.time || entry.date;
      const when = ts ? new Date(ts) : undefined;
      return when
        ? { label, at: when.toISOString() }
        : { label, at: new Date().toISOString() };
    });

  if (mapped.length === 0) {
    return [
      {
        label: 'Job registered',
        at: new Date().toISOString()
      }
    ];
  }

  return mapped.sort((a, b) => a.at.localeCompare(b.at));
}

function normalizeWorker(id: string, payload: any): JobWorkerStatus {
  const ports = coerceArray<number>(payload?.open_ports ?? payload?.openPorts);
  const startPort = payload?.start_port ?? payload?.startPort ?? Math.min(...ports, 1);
  const endPort = payload?.end_port ?? payload?.endPort ?? Math.max(...ports, startPort ?? 1);

  return {
    id,
    startPort: typeof startPort === 'number' ? startPort : 1,
    endPort: typeof endPort === 'number' ? endPort : 1,
    progress: Number.parseFloat(payload?.progress) || 0,
    done: Boolean(payload?.done ?? payload?.finished),
    canceled: Boolean(payload?.canceled ?? payload?.cancelled),
    portsScanned: Number(payload?.ports_scanned ?? payload?.portsScanned ?? ports.length),
    openPorts: ports,
    serviceInfo: payload?.service_info ?? payload?.serviceInfo ?? {},
    webTestsInfo: payload?.web_tests_info ?? payload?.webTestsInfo ?? {},
    completedTests: coerceArray<string>(payload?.completed_tests ?? payload?.completedTests)
  };
}

function deriveStatus(raw: any): JobStatus {
  const explicit = (raw?.status ?? raw?.state ?? '').toString().toLowerCase();
  if (['queued', 'pending'].includes(explicit)) {
    return 'queued';
  }
  if (['running', 'in_progress', 'in-progress'].includes(explicit)) {
    return 'running';
  }
  if (['completed', 'done', 'success'].includes(explicit)) {
    return 'completed';
  }
  if (['failed', 'error'].includes(explicit)) {
    return 'failed';
  }
  if (['cancelled', 'canceled'].includes(explicit)) {
    return 'cancelled';
  }

  const workers = raw?.workers;
  if (workers && typeof workers === 'object') {
    const workerList = Object.values(workers) as any[];
    if (workerList.length && workerList.every((worker) => worker?.finished || worker?.done)) {
      return 'completed';
    }
    if (workerList.some((worker) => worker?.finished || worker?.done)) {
      return 'running';
    }
  }

  return 'queued';
}

function normalizeAggregate(raw: any): JobAggregateReport | undefined {
  if (!raw) {
    return undefined;
  }

  return {
    openPorts: coerceArray<number>(raw.open_ports ?? raw.openPorts),
    serviceSummary: raw.serviceSummary ?? raw.service_summary ?? raw.service_info ?? {},
    webFindings: raw.webFindings ?? raw.web_findings ?? raw.web_tests_info ?? {},
    notes: raw.notes
  };
}

function normalizeDistribution(value: unknown): JobDistribution {
  const normalized = value?.toString().toLowerCase() ?? '';
  if (['mirror', 'shared', 'duplicate', 'all'].includes(normalized)) {
    return 'mirror';
  }

  return 'slice';
}

function normalizeDuration(value: unknown): JobDuration {
  const normalized = value?.toString().toLowerCase() ?? '';
  if (['continuous', 'monitor', 'monitoring', 'loop'].includes(normalized)) {
    return 'continuous';
  }

  return 'singlepass';
}

function normalizeTempo(raw: any): JobTempo | undefined {
  if (!raw) {
    return undefined;
  }

  if (Array.isArray(raw) && raw.length === 2) {
    const [minCandidate, maxCandidate] = raw;
    const minSeconds = Number(minCandidate);
    const maxSeconds = Number(maxCandidate);
    if (Number.isFinite(minSeconds) && Number.isFinite(maxSeconds) && maxSeconds >= minSeconds && minSeconds > 0) {
      return { minSeconds, maxSeconds };
    }
  }

  const minSeconds = Number(
    raw.min_seconds ?? raw.min ?? raw.minSeconds ?? raw.lower ?? raw.from ?? raw.start
  );
  const maxSeconds = Number(
    raw.max_seconds ?? raw.max ?? raw.maxSeconds ?? raw.upper ?? raw.to ?? raw.end
  );

  if (Number.isFinite(minSeconds) && Number.isFinite(maxSeconds) && minSeconds > 0 && maxSeconds >= minSeconds) {
    return { minSeconds, maxSeconds };
  }

  return undefined;
}

function normalizeTempoSteps(raw: any): JobTempoSteps | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  const coerceNumber = (value: any) => Number(value);
  const directNumber = coerceNumber(raw);

  if (Number.isInteger(directNumber) && directNumber > 0) {
    return { min: directNumber, max: directNumber };
  }

  const min = coerceNumber(
    raw.min_steps ?? raw.min ?? raw.minSteps ?? raw.lower ?? raw.from ?? raw.start ?? raw.min_count ?? raw.minCount
  );
  const max = coerceNumber(
    raw.max_steps ?? raw.max ?? raw.maxSteps ?? raw.upper ?? raw.to ?? raw.end ?? raw.max_count ?? raw.maxCount
  );

  if (Number.isInteger(min) && Number.isInteger(max) && min > 0 && max >= min) {
    return { min, max };
  }

  return undefined;
}

function normalizeJob(raw: any): Job {
  ensure(raw, 500, 'Job payload missing.');
  const id = raw.job_id ?? raw.jobId ?? raw.id ?? raw.uuid;
  ensure(id, 500, 'Job payload missing identifier.');

  const status = deriveStatus(raw);
  const createdAt = raw.created_at ?? raw.createdAt ?? new Date().toISOString();
  const updatedAt = raw.updated_at ?? raw.updatedAt ?? createdAt;
  const startedAt = raw.started_at ?? raw.startedAt;
  const completedAt = raw.completed_at ?? raw.completedAt;

  const workersPayload = raw.workers && typeof raw.workers === 'object' ? raw.workers : {};
  const workers = Object.entries(workersPayload).map(([workerId, payload]) =>
    normalizeWorker(workerId, payload)
  );

  const aggregate = normalizeAggregate(raw.aggregate ?? raw.result ?? raw.report);
  const timeline = extractTimeline(raw);
  const tempoPayload =
    raw.tempo ??
    raw.test_tempo ??
    (raw.tempo_min_seconds || raw.tempo_max_seconds
      ? { min_seconds: raw.tempo_min_seconds, max_seconds: raw.tempo_max_seconds }
      : undefined);
  const tempoStepsPayload =
    raw.tempo?.steps ??
    raw.tempo_steps ??
    raw.steps ??
    raw.iterations ??
    raw.repetitions ??
    raw.tempoIterations ??
    (raw.tempo_steps_min !== undefined || raw.tempo_steps_max !== undefined
      ? { min: raw.tempo_steps_min, max: raw.tempo_steps_max }
      : undefined);
  const tempoSteps = normalizeTempoSteps(tempoStepsPayload);

  return {
    id,
    displayName: raw.name ?? raw.title ?? raw.display_name ?? `RedMesh job ${id}`,
    target: raw.target ?? raw.host ?? raw.endpoint ?? 'unknown',
    initiator: raw.launcher ?? raw.initiator ?? raw.owner ?? 'unknown',
    status,
    summary: raw.summary ?? raw.description ?? 'No summary provided.',
    createdAt,
    updatedAt,
    startedAt: startedAt ?? undefined,
    completedAt: completedAt ?? undefined,
    owner: raw.owner ?? raw.launcher ?? undefined,
    payloadUri: raw.payload_uri ?? raw.payloadUri ?? undefined,
    priority: normalizePriority(raw.priority ?? raw.jobPriority ?? 'medium'),
    workerCount: workers.length || Number(raw.worker_count ?? raw.nrWorkers ?? 0),
    exceptionPorts: coerceArray<number>(raw.exceptions ?? raw.exception_ports),
    featureSet: coerceArray<string>(raw.features ?? raw.feature_set ?? getAvailableFeatures()),
    workers,
    aggregate,
    timeline,
    lastError: raw.error ?? raw.last_error ?? undefined,
    distribution: normalizeDistribution(raw.distribution ?? raw.worker_distribution ?? raw.range_distribution),
    duration: normalizeDuration(raw.duration ?? raw.run_mode ?? raw.mode),
    tempo: normalizeTempo(tempoPayload),
    tempoSteps
  } as Job;
}

function normalizePriority(value: unknown): JobPriority {
  const normalized = value?.toString().toLowerCase();
  switch (normalized) {
    case 'low':
    case 'medium':
    case 'high':
    case 'critical':
      return normalized;
    default:
      return 'medium';
  }
}

/**
 * Transform JobSpecs from RedMesh API to UI Job type.
 * This handles the specific field mappings from the actual API response format.
 */
function normalizeJobFromSpecs(specs: JobSpecs): Job {
  const createdAt = specs.created_at
    ? new Date(specs.created_at * 1000).toISOString()
    : new Date().toISOString();

  // Transform workers from Record<string, WorkerAssignment> to JobWorkerStatus[]
  const workers = Object.entries(specs.workers).map(([workerId, assignment]) => ({
    id: workerId,
    startPort: assignment.start_port,
    endPort: assignment.end_port,
    progress: assignment.finished ? 100 : 0,
    done: assignment.finished,
    canceled: false,
    portsScanned: assignment.finished ? (assignment.end_port - assignment.start_port + 1) : 0,
    openPorts: [],
    serviceInfo: {},
    webTestsInfo: {},
    completedTests: []
  }));

  // Derive status from worker states
  const workerList = Object.values(specs.workers);
  let status: JobStatus = 'queued';
  if (workerList.length > 0) {
    if (workerList.every((w) => w.finished)) {
      status = 'completed';
    } else if (workerList.some((w) => w.finished) || workerList.length > 0) {
      status = 'running';
    }
  }

  // Generate timeline from created_at
  const timeline: JobTimelineEntry[] = [
    { label: 'Job created', at: createdAt }
  ];

  // Map distribution_strategy to UI format
  const distribution: JobDistribution = specs.distribution_strategy === 'MIRROR' ? 'mirror' : 'slice';

  // Map run_mode to UI format
  const duration: JobDuration = specs.run_mode === 'CONTINUOUS_MONITORING' ? 'continuous' : 'singlepass';

  return {
    id: specs.job_id,
    displayName: specs.task_name || `${specs.target} - ${specs.job_id.slice(0, 8)}`,
    target: specs.target,
    initiator: specs.launcher_alias ?? specs.launcher,
    status,
    summary: specs.task_description || 'RedMesh scan job',
    createdAt,
    updatedAt: createdAt,
    startedAt: status === 'running' || status === 'completed' ? createdAt : undefined,
    completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    owner: specs.launcher,
    payloadUri: undefined,
    priority: 'medium',
    workerCount: workers.length,
    exceptionPorts: specs.exceptions,
    featureSet: specs.enabled_features,
    workers,
    aggregate: undefined,
    timeline,
    lastError: undefined,
    distribution,
    duration,
    tempo: specs.scan_min_delay && specs.scan_max_delay
      ? { minSeconds: specs.scan_min_delay, maxSeconds: specs.scan_max_delay }
      : undefined,
    tempoSteps: undefined
  };
}

/**
 * Transform GetJobStatusResponse to UI Job type.
 * Handles different response variants (completed, running, network_tracked, not_found).
 */
export function normalizeJobStatusResponse(response: GetJobStatusResponse): Job | null {
  if (response.status === 'not_found') {
    return null;
  }

  if (response.status === 'network_tracked') {
    return normalizeJobFromSpecs(response.job);
  }

  // For running and completed statuses, we have job_id and target
  const baseJob: Partial<Job> = {
    id: response.job_id,
    target: response.target,
    displayName: `${response.target} - ${response.job_id.slice(0, 8)}`,
    summary: 'RedMesh scan job',
    initiator: 'unknown',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [{ label: 'Status checked', at: new Date().toISOString() }],
    exceptionPorts: [],
    featureSet: []
  };

  if (response.status === 'running') {
    const workers = Object.entries(response.workers).map(([workerId, progress]) => ({
      id: workerId,
      startPort: progress.start_port,
      endPort: progress.end_port,
      progress: parseFloat(progress.progress) || 0,
      done: progress.done,
      canceled: progress.canceled,
      portsScanned: progress.ports_scanned,
      openPorts: progress.open_ports,
      serviceInfo: {},
      webTestsInfo: {},
      completedTests: []
    }));

    return {
      ...baseJob,
      status: 'running',
      workerCount: workers.length,
      workers
    } as Job;
  }

  if (response.status === 'completed') {
    // Aggregate data from worker reports
    const allOpenPorts: number[] = [];
    const serviceSummary: Record<string, string> = {};
    const webFindings: Record<string, string> = {};

    const workers = Object.entries(response.report).map(([workerId, report]) => {
      allOpenPorts.push(...report.open_ports);

      // Merge service info
      for (const [port, info] of Object.entries(report.service_info)) {
        serviceSummary[port] = info.service ?? info.banner ?? 'Unknown';
      }

      // Merge web test findings
      for (const [testId, result] of Object.entries(report.web_tests_info)) {
        if (result.vulnerable) {
          webFindings[testId] = result.details ?? 'Vulnerable';
        }
      }

      return {
        id: workerId,
        startPort: report.start_port,
        endPort: report.end_port,
        progress: 100,
        done: report.done,
        canceled: report.canceled,
        portsScanned: report.ports_scanned,
        openPorts: report.open_ports,
        serviceInfo: Object.fromEntries(
          Object.entries(report.service_info).map(([p, i]) => [p, i.service ?? ''])
        ),
        webTestsInfo: Object.fromEntries(
          Object.entries(report.web_tests_info).map(([t, r]) => [t, r.vulnerable ? 'Vulnerable' : 'Safe'])
        ),
        completedTests: report.completed_tests
      };
    });

    return {
      ...baseJob,
      status: 'completed',
      completedAt: new Date().toISOString(),
      workerCount: workers.length,
      workers,
      aggregate: {
        openPorts: [...new Set(allOpenPorts)],
        serviceSummary,
        webFindings
      }
    } as Job;
  }

  return null;
}

/**
 * Get excluded method names from deselected feature groups.
 * The UI tracks selected feature group IDs, but the backend expects method names.
 */
function getExcludedMethods(selectedFeatureIds: string[]): string[] {
  const catalog = getDefaultFeatureCatalog();
  const excludedMethods: string[] = [];

  for (const feature of catalog) {
    if (!selectedFeatureIds.includes(feature.id)) {
      // This feature group is not selected, add all its methods to excluded
      excludedMethods.push(...feature.methods);
    }
  }

  return excludedMethods;
}

/**
 * Transform CreateJobInput to LaunchTestRequest for RedMesh API.
 */
function createJobInputToLaunchRequest(input: CreateJobInput): LaunchTestRequest {
  // Get excluded methods from deselected feature groups
  const excludedFeatures = input.features?.length
    ? getExcludedMethods(input.features)
    : undefined;

  return {
    target: input.target,
    start_port: input.portRange.start,
    end_port: input.portRange.end,
    exceptions: input.exceptions?.join(','),
    distribution_strategy: input.distribution === 'mirror' ? 'MIRROR' : 'SLICE',
    port_order: 'SEQUENTIAL',
    excluded_features: excludedFeatures?.length ? excludedFeatures : undefined,
    run_mode: input.duration === 'continuous' ? 'CONTINUOUS_MONITORING' : 'SINGLEPASS',
    scan_min_delay: input.scanDelay?.minSeconds,
    scan_max_delay: input.scanDelay?.maxSeconds,
    task_name: input.name || undefined,
    task_description: input.summary || undefined
  };
}

export async function fetchJobs(authToken?: string): Promise<Job[]> {
  const config = getAppConfig();

  if (config.mockMode || config.forceMockTasks) {
    return getMockJobs();
  }

  if (!config.redmeshApiUrl) {
    throw new ApiError(500, 'RedMesh API endpoint is not configured.');
  }

  try {
    const api = getRedMeshApiService();
    const networkJobs = await api.listNetworkJobs();

    // Transform JobSpecs Record to Job array
    const jobs = Object.values(networkJobs).map(normalizeJobFromSpecs);
    return jobs;
  } catch (error) {
    console.error('[fetchJobs] Error fetching jobs:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : 'Unable to retrieve jobs from RedMesh.');
  }
}

export async function createJob(
  input: CreateJobInput,
  options: { authToken?: string; owner?: string }
): Promise<Job> {
  const config = getAppConfig();

  if (config.mockMode || config.forceMockTasks) {
    return createMockJob(input, options.owner);
  }

  if (!config.redmeshApiUrl) {
    throw new ApiError(500, 'RedMesh API endpoint is not configured.');
  }

  try {
    const api = getRedMeshApiService();
    const request = createJobInputToLaunchRequest(input);
    const response = await api.launchTest(request);

    // Transform the job_specs from the response to UI Job type
    return normalizeJobFromSpecs(response.job_specs);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : 'Unable to create RedMesh job.');
  }
}
