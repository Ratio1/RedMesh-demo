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
  const normalized = value?.toString().toLowerCase();
  if (['mirror', 'shared', 'duplicate', 'all'].includes(normalized)) {
    return 'mirror';
  }

  return 'slice';
}

function normalizeDuration(value: unknown): JobDuration {
  const normalized = value?.toString().toLowerCase();
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

export async function fetchJobs(authToken?: string): Promise<Job[]> {
  const config = getAppConfig();

  if (config.mockMode) {
    return getMockJobs();
  }

  if (!config.redmeshApiUrl) {
    throw new ApiError(500, 'RedMesh API endpoint is not configured.');
  }

  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${config.redmeshApiUrl}/jobs`, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || 'Unable to retrieve jobs from RedMesh.');
  }

  const payload = await response.json();
  const items: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.jobs) ? payload.jobs : [];

  return items.map((item) => normalizeJob(item));
}

export async function createJob(
  input: CreateJobInput,
  options: { authToken?: string; owner?: string }
): Promise<Job> {
  const config = getAppConfig();

  if (config.mockMode) {
    return createMockJob(input, options.owner);
  }

  if (!config.redmeshApiUrl) {
    throw new ApiError(500, 'RedMesh API endpoint is not configured.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  const response = await fetch(`${config.redmeshApiUrl}/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: input.name,
      summary: input.summary,
      target: input.target,
      port_range: input.portRange,
      exceptions: input.exceptions,
      features: input.features,
      worker_count: input.workerCount,
      payload_uri: input.payloadUri,
      priority: input.priority,
      distribution: input.distribution ?? 'slice',
      duration: input.duration ?? 'singlepass',
      tempo: input.tempo
        ? { min_seconds: input.tempo.minSeconds, max_seconds: input.tempo.maxSeconds }
        : undefined,
      tempo_steps: input.tempoSteps ? { min: input.tempoSteps.min, max: input.tempoSteps.max } : undefined,
      ...(input.tempoSteps
        ? { tempo_steps_min: input.tempoSteps.min, tempo_steps_max: input.tempoSteps.max }
        : {}),
      host_id: config.hostId,
      source: 'redmesh-demo-ui'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || 'Unable to create RedMesh job.');
  }

  const payload = await response.json();
  const jobPayload = payload?.job ?? payload;
  return normalizeJob(jobPayload);
}
