import { ApiError, ensure } from './errors';
import {
  CreateJobInput,
  Job,
  JobAggregateReport,
  JobDistribution,
  JobDuration,
  JobPortOrder,
  JobPriority,
  JobRunMode,
  JobStatus,
  JobTimelineEntry,
  JobTempo,
  JobTempoSteps,
  JobWorkerStatus,
  PassHistoryEntry
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
import {
  extractCidsFromJobs,
  fetchReportsByCids,
  fetchLlmAnalysisByCid
} from '../services/edgeClient';

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
  if (['running', 'in_progress', 'in-progress'].includes(explicit)) {
    return 'running';
  }
  if (['stopping', 'scheduled_for_stop', 'scheduled-for-stop'].includes(explicit)) {
    return 'stopping';
  }
  if (['stopped'].includes(explicit)) {
    return 'stopped';
  }
  if (['completed', 'done', 'success', 'finalized'].includes(explicit)) {
    return 'completed';
  }

  // Derive from worker states if no explicit status
  const workers = raw?.workers;
  if (workers && typeof workers === 'object') {
    const workerList = Object.values(workers) as any[];
    if (workerList.length && workerList.every((worker) => worker?.finished || worker?.done)) {
      return 'completed';
    }
  }

  // Default: jobs start as running
  return 'running';
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
    startedAt,
    completedAt,
    owner: raw.owner ?? raw.launcher,
    payloadUri: raw.payload_uri ?? raw.payloadUri,
    priority: normalizePriority(raw.priority ?? raw.jobPriority ?? 'medium'),
    workerCount: workers.length || Number(raw.worker_count ?? raw.nrWorkers ?? 0),
    exceptionPorts: coerceArray<number>(raw.exceptions ?? raw.exception_ports),
    featureSet: coerceArray<string>(raw.features ?? raw.feature_set ?? getAvailableFeatures()),
    workers,
    aggregate,
    timeline,
    lastError: raw.error ?? raw.last_error,
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
  const createdAt = specs.date_created
    ? new Date(specs.date_created * 1000).toISOString()
    : new Date().toISOString();

  const updatedAt = specs.date_updated
    ? new Date(specs.date_updated * 1000).toISOString()
    : createdAt;

  const finalizedAt = specs.date_finalized
    ? new Date(specs.date_finalized * 1000).toISOString()
    : undefined;

  // Transform workers from Record<string, WorkerAssignment> to JobWorkerStatus[]
  const workers = Object.entries(specs.workers).map(([workerId, assignment]) => ({
    id: workerId,
    startPort: assignment.start_port,
    endPort: assignment.end_port,
    progress: assignment.finished ? 100 : 0,
    done: assignment.finished,
    canceled: assignment.canceled ?? false,
    portsScanned: assignment.finished ? (assignment.end_port - assignment.start_port + 1) : 0,
    openPorts: [],
    serviceInfo: {},
    webTestsInfo: {},
    completedTests: []
  }));

  // Derive status from job_status field
  let status: JobStatus = 'running'; // Jobs start as running
  const jobStatus = specs.job_status?.toUpperCase();
  if (jobStatus === 'FINALIZED') {
    status = 'completed';
  } else if (jobStatus === 'RUNNING') {
    status = 'running';
  } else if (jobStatus === 'SCHEDULED_FOR_STOP') {
    status = 'stopping';
  } else if (jobStatus === 'STOPPED') {
    status = 'stopped';
  }

  // Generate timeline from timestamps
  const timeline: JobTimelineEntry[] = [
    { label: 'Job created', at: createdAt }
  ];
  if (status === 'running' || status === 'stopping' || status === 'completed' || status === 'stopped') {
    timeline.push({ label: 'Job started', at: createdAt });
  }
  if (finalizedAt) {
    timeline.push({ label: 'Job finalized', at: finalizedAt });
  }

  // Map distribution_strategy to UI format
  const distribution: JobDistribution = specs.distribution_strategy === 'MIRROR' ? 'mirror' : 'slice';

  // Map run_mode to UI format
  const runMode: JobRunMode = specs.run_mode === 'CONTINUOUS_MONITORING' ? 'continuous' : 'singlepass';

  // Map port_order to UI format
  const portOrder: JobPortOrder = specs.port_order?.toLowerCase() === 'random' ? 'random' : 'sequential';

  // Normalize pass_history to UI format
  const passHistory: PassHistoryEntry[] | undefined = specs.pass_history?.map((entry) => ({
    passNr: entry.pass_nr,
    completedAt: new Date(entry.completed_at * 1000).toISOString(),
    reports: entry.reports,
    llmAnalysisCid: entry.llm_analysis_cid
  }));

  // Next pass at (for continuous monitoring)
  const nextPassAt = specs.next_pass_at
    ? new Date(specs.next_pass_at * 1000).toISOString()
    : undefined;

  return {
    id: specs.job_id,
    displayName: specs.task_name || `${specs.target} - ${specs.job_id?.slice(0, 8) ?? 'new'}`,
    target: specs.target,
    initiator: specs.launcher_alias ?? specs.launcher,
    initiatorAddress: specs.launcher,
    initiatorAlias: specs.launcher_alias,
    status,
    summary: specs.task_description || 'RedMesh scan job',
    createdAt,
    updatedAt,
    startedAt: createdAt,
    completedAt: finalizedAt,
    finalizedAt,
    owner: specs.launcher,
    payloadUri: undefined,
    priority: 'medium',
    workerCount: workers.length,
    exceptionPorts: specs.exceptions ?? [],
    featureSet: specs.enabled_features ?? [],
    excludedFeatures: specs.excluded_features ?? [],
    workers,
    aggregate: undefined,
    timeline,
    lastError: undefined,
    distribution,
    duration: runMode,
    runMode,
    portOrder,
    portRange: { start: specs.start_port, end: specs.end_port },
    currentPass: specs.job_pass ?? 1,
    monitorInterval: specs.monitor_interval,
    nextPassAt,
    monitoringStatus: specs.monitoring_status,
    tempo: specs.scan_min_delay != null && specs.scan_max_delay != null
      ? { minSeconds: specs.scan_min_delay, maxSeconds: specs.scan_max_delay }
      : undefined,
    tempoSteps: undefined,
    passHistory
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
    displayName: `${response.target ?? 'unknown'} - ${response.job_id?.slice(0, 8) ?? 'new'}`,
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

      // Merge service info for aggregate summary
      for (const [port, info] of Object.entries(report.service_info)) {
        // Extract a human-readable summary for the aggregate
        const infoObj = info as Record<string, unknown>;
        const sshBanner = infoObj._service_info_22 as string | undefined;
        const genericBanner = infoObj._service_info_generic as string | undefined;
        serviceSummary[port] = sshBanner ?? genericBanner ?? 'Service detected';
      }

      // Merge web test findings for aggregate summary
      for (const [port, testResults] of Object.entries(report.web_tests_info)) {
        const results = testResults as Record<string, string>;
        for (const [testId, result] of Object.entries(results)) {
          if (result && !result.startsWith('ERROR:')) {
            webFindings[`${port}:${testId}`] = result;
          }
        }
      }

      // Preserve full service_info and web_tests_info data
      // The API returns service_info keyed by port, with each port having multiple probe results
      const serviceInfoFull: Record<string, Record<string, unknown>> = {};
      for (const [port, info] of Object.entries(report.service_info)) {
        serviceInfoFull[port] = info as Record<string, unknown>;
      }

      const webTestsInfoFull: Record<string, Record<string, unknown>> = {};
      for (const [port, tests] of Object.entries(report.web_tests_info)) {
        webTestsInfoFull[port] = tests as Record<string, unknown>;
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
        serviceInfo: serviceInfoFull,
        webTestsInfo: webTestsInfoFull,
        completedTests: report.completed_tests,
        // Additional fields from completed job reports
        target: report.target,
        initiator: report.initiator,
        jobId: report.job_id,
        webTested: report.web_tested,
        nrOpenPorts: report.nr_open_ports,
        exceptions: report.exceptions
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
    monitor_interval: input.duration === 'continuous' ? input.monitorInterval : undefined,
    scan_min_delay: input.scanDelay?.minSeconds,
    scan_max_delay: input.scanDelay?.maxSeconds,
    task_name: input.name || undefined,
    task_description: input.summary || undefined,
    selected_peers: input.selectedPeers?.length ? input.selectedPeers : undefined
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
    const jobSpecs = await api.listNetworkJobs();

    // Transform JobSpecs Record to Job array
    const jobs = Object.values(jobSpecs).map(normalizeJobFromSpecs);
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

/**
 * Fetch jobs along with their report content from R1FS.
 * Returns normalized jobs and a mapping of { cid: json_content }.
 */
export async function fetchJobsWithReports(authToken?: string): Promise<{
  jobs: Job[];
  reports: Record<string, Record<string, unknown>>;
}> {
  const config = getAppConfig();

  if (config.mockMode || config.forceMockTasks) {
    return {
      jobs: getMockJobs(),
      reports: {}
    };
  }

  if (!config.redmeshApiUrl) {
    throw new ApiError(500, 'RedMesh API endpoint is not configured.');
  }

  try {
    const api = getRedMeshApiService();
    const jobSpecs = await api.listNetworkJobs();

    // Extract CIDs from pass_history and fetch their content from R1FS
    const cids = extractCidsFromJobs(jobSpecs);
    const reports = await fetchReportsByCids(cids);

    // Transform JobSpecs Record to Job array
    const jobs = Object.values(jobSpecs).map(normalizeJobFromSpecs);

    return { jobs, reports };
  } catch (error) {
    console.error('[fetchJobsWithReports] Error fetching jobs with reports:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : 'Unable to retrieve jobs from RedMesh.');
  }
}

/**
 * Extract CIDs from a single job's pass_history
 */
function extractCidsFromJob(job: Job): string[] {
  const cids: string[] = [];
  if (job.passHistory) {
    for (const pass of job.passHistory) {
      if (pass.reports) {
        cids.push(...Object.values(pass.reports));
      }
    }
  }
  return cids;
}

/**
 * Extract LLM analysis CIDs from a single job's pass_history
 * Returns a mapping of passNr -> llmAnalysisCid
 */
function extractLlmAnalysisCidsFromJob(job: Job): Record<number, string> {
  const cids: Record<number, string> = {};
  if (job.passHistory) {
    for (const pass of job.passHistory) {
      if (pass.llmAnalysisCid) {
        cids[pass.passNr] = pass.llmAnalysisCid;
      }
    }
  }
  return cids;
}

/**
 * Fetch a single job with its report content from R1FS.
 * Uses get_job_data as the primary endpoint for job specs and pass_history.
 * Falls back to get_job_status for real-time worker data (service_info, web_tests_info).
 */
export async function fetchJobWithReports(jobId: string): Promise<{
  job: Job;
  reports: Record<string, Record<string, unknown>>;
  /** Worker-level detailed scan results from get_job_status (for completed jobs) */
  workerResults?: Job['workers'];
  /** LLM analysis content for each pass (passNr -> analysis) */
  llmAnalyses?: Record<number, Record<string, unknown>>;
} | null> {
  const config = getAppConfig();

  if (config.mockMode || config.forceMockTasks) {
    const mockJobs = getMockJobs();
    const job = mockJobs.find(j => j.id === jobId);
    if (!job) return null;
    return { job, reports: {} };
  }

  if (!config.redmeshApiUrl) {
    throw new ApiError(500, 'RedMesh API endpoint is not configured.');
  }

  try {
    const api = getRedMeshApiService();

    // Primary: Use get_job_data for job specs and pass_history
    const jobDataResponse = await api.getJobData(jobId);

    if (!jobDataResponse.found || !jobDataResponse.job) {
      // Fall back to get_job_status if get_job_data doesn't find the job
      const statusResponse = await api.getJobStatus(jobId);
      if (statusResponse.status === 'not_found') {
        return null;
      }

      const job = normalizeJobStatusResponse(statusResponse);
      if (!job) {
        return null;
      }

      const cids = extractCidsFromJob(job);
      const reports = cids.length > 0 ? await fetchReportsByCids(cids) : {};

      return { job, reports };
    }

    // Normalize job from JobSpecs
    const job = normalizeJobFromSpecs(jobDataResponse.job);

    // Extract CIDs from pass_history and fetch reports
    const cids = extractCidsFromJob(job);
    const reports = cids.length > 0 ? await fetchReportsByCids(cids) : {};

    // Extract and fetch LLM analysis for each pass
    const llmAnalysisCids = extractLlmAnalysisCidsFromJob(job);
    const llmAnalyses: Record<number, Record<string, unknown>> = {};

    const llmFetchPromises = Object.entries(llmAnalysisCids).map(async ([passNrStr, cid]) => {
      const passNr = parseInt(passNrStr, 10);
      const analysis = await fetchLlmAnalysisByCid(cid);
      if (analysis) {
        llmAnalyses[passNr] = analysis;
      }
    });
    await Promise.all(llmFetchPromises);

    // For completed/running jobs, also fetch get_job_status for worker-level details
    // This provides service_info, web_tests_info, open_ports from workers
    let workerResults: Job['workers'] | undefined;

    try {
      const statusResponse = await api.getJobStatus(jobId);

      if (statusResponse.status === 'completed') {
        // Extract detailed worker results from completed job status
        const completedJob = normalizeJobStatusResponse(statusResponse);
        if (completedJob) {
          workerResults = completedJob.workers;
          // Merge aggregate data
          if (completedJob.aggregate) {
            job.aggregate = completedJob.aggregate;
          }
        }
      } else if (statusResponse.status === 'running') {
        // For running jobs, get real-time worker progress
        const runningJob = normalizeJobStatusResponse(statusResponse);
        if (runningJob) {
          workerResults = runningJob.workers;
        }
      }
    } catch (statusError) {
      // get_job_status may fail for some jobs, that's ok - we still have job data
      console.warn(`[fetchJobWithReports] get_job_status failed for ${jobId}:`, statusError);
    }

    // Merge worker results into job if available
    if (workerResults && workerResults.length > 0) {
      job.workers = workerResults;
      job.workerCount = workerResults.length;
    }

    return { job, reports, workerResults, llmAnalyses };
  } catch (error) {
    console.error(`[fetchJobWithReports] Error fetching job ${jobId}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : 'Unable to retrieve job from RedMesh.');
  }
}
