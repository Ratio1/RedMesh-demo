import { randomUUID } from 'crypto';
import {
  AuthSuccess,
  CreateJobInput,
  Job,
  JobStatus,
  JobTimelineEntry,
  JobWorkerStatus
} from './types';
import { ApiError } from './errors';
import { REDMESH_FEATURE_CATALOG, getDefaultFeatureIds } from '../domain/features';

interface MockUserRecord {
  id: string;
  username: string;
  displayName: string;
  password: string;
  roles: string[];
  permissions: string[];
}

const MOCK_USERS: MockUserRecord[] = [
  {
    id: '8f6f5d01-0417-4e70-8f32-12b0c33a3d61',
    username: 'operator',
    displayName: 'Mesh Operator',
    password: 'operator123',
    roles: ['operator'],
    permissions: ['jobs:read', 'jobs:create']
  },
  {
    id: '44c7ef4d-7049-42ad-8b13-9bf0b060b3f1',
    username: 'admin',
    displayName: 'System Admin',
    password: 'admin123',
    roles: ['admin'],
    permissions: ['jobs:read', 'jobs:create', 'jobs:cancel']
  }
];

function buildWorker(
  idSuffix: string,
  startPort: number,
  endPort: number,
  done: boolean,
  overrides: Partial<JobWorkerStatus> = {}
): JobWorkerStatus {
  const defaultWorker: JobWorkerStatus = {
    id: `RM-NODE-${idSuffix}`,
    startPort,
    endPort,
    progress: done ? 100 : 45,
    done,
    canceled: false,
    portsScanned: done ? endPort - startPort + 1 : Math.floor((endPort - startPort + 1) * 0.45),
    openPorts: done ? [22, 80].filter((port) => port >= startPort && port <= endPort) : [],
    serviceInfo: {
      'ssh': 'OpenSSH 9.0p1',
      'http': 'nginx 1.24.0'
    },
    webTestsInfo: {
      security_headers: done ? 'Missing Content-Security-Policy' : 'Pending',
      common_paths: done ? 'Accessible /admin login form detected' : 'Pending'
    },
    completedTests: done ? ['port_scan', 'service_probe', 'web_test_security_headers'] : ['port_scan']
  };

  return {
    ...defaultWorker,
    ...overrides
  };
}

function buildTimeline(entries: Array<{ label: string; at: Date }>): JobTimelineEntry[] {
  return entries
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ label, at }) => ({
      label,
      at: at.toISOString()
    }));
}

function buildJob(partial?: Partial<Job>): Job {
  const now = new Date();
  const started = new Date(now.getTime() - 1000 * 60 * 35);
  const completed = new Date(now.getTime() - 1000 * 60 * 5);

  const workers: JobWorkerStatus[] = [
    buildWorker('A1', 1, 1024, true),
    buildWorker('B4', 1025, 2048, true),
    buildWorker('C9', 2049, 4096, true)
  ];

  const aggregate = {
    openPorts: Array.from(new Set(workers.flatMap((worker) => worker.openPorts))).sort((a, b) => a - b),
    serviceSummary: {
      ssh: 'OpenSSH 9.0p1 allows password authentication',
      http: 'nginx 1.24.0 without CSP header'
    },
    webFindings: {
      security_headers: 'Missing Content-Security-Policy header',
      admin_panel: 'Accessible login form at /admin with default branding'
    }
  };

  const timeline = buildTimeline([
    { label: 'Job created', at: new Date(now.getTime() - 1000 * 60 * 40) },
    { label: 'Dispatch issued to workers', at: started },
    { label: 'Aggregated report published', at: completed }
  ]);

  const job: Job = {
    id: randomUUID(),
    displayName: 'Mesh Recon - Internal perimeter',
    target: '10.0.5.12',
    initiator: 'ratio1-admin',
    status: 'completed',
    summary: 'Reconnaissance sweep across the internal perimeter VLAN.',
    createdAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
    updatedAt: completed.toISOString(),
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    owner: 'security-team',
    payloadUri: 'r1fs://perimeter/recon-batch-12.json',
    priority: 'medium',
    workerCount: workers.length,
    exceptionPorts: [25, 161],
    featureSet: getDefaultFeatureIds(),
    workers,
    aggregate,
    timeline
  };

  return {
    ...job,
    ...partial,
    timeline: partial?.timeline ?? timeline,
    workers: partial?.workers ?? workers,
    aggregate: partial?.aggregate ?? aggregate
  };
}

const INITIAL_JOBS: Job[] = [
  buildJob(),
  buildJob({
    id: randomUUID(),
    displayName: 'Mesh Breach Simulation - Finance cluster',
    target: '172.19.20.5',
    status: 'running',
    summary: 'Simulated breach drill across finance subnet to validate containment.',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    completedAt: undefined,
    priority: 'high',
    workers: [
      buildWorker('F1', 1, 2000, false),
      buildWorker('F2', 2001, 4000, false, {
        progress: 62,
        portsScanned: 1234,
        openPorts: [3389]
      })
    ],
    workerCount: 2,
    aggregate: undefined,
    timeline: buildTimeline([
      { label: 'Job created', at: new Date(Date.now() - 1000 * 60 * 25) },
      { label: 'Dispatch issued to workers', at: new Date(Date.now() - 1000 * 60 * 20) }
    ])
  }),
  buildJob({
    id: randomUUID(),
    displayName: 'Mesh Diagnostics - Edge Node health',
    target: 'self',
    status: 'queued',
    summary: 'Queued diagnostic bundle for the Worker App Runner plugin.',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    startedAt: undefined,
    completedAt: undefined,
    priority: 'low',
    workers: [],
    aggregate: undefined,
    featureSet: ['service_info_common'],
    timeline: buildTimeline([
      { label: 'Job created', at: new Date(Date.now() - 1000 * 60 * 5) }
    ])
  })
];

let mutableJobs = [...INITIAL_JOBS];

function computeTimelineEntry(status: JobStatus): string {
  switch (status) {
    case 'queued':
      return 'Job queued';
    case 'running':
      return 'Workers executing';
    case 'completed':
      return 'Job completed';
    case 'failed':
      return 'Job failed';
    case 'cancelled':
      return 'Job cancelled';
    default:
      return 'Status updated';
  }
}

export function getMockJobs(): Job[] {
  return [...mutableJobs];
}

export function createMockJob(input: CreateJobInput, owner?: string): Job {
  const now = new Date();
  const job: Job = {
    id: randomUUID(),
    displayName: input.name,
    target: input.target,
    initiator: owner ?? 'operator',
    status: 'queued',
    summary: input.summary,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    startedAt: undefined,
    completedAt: undefined,
    owner,
    payloadUri: input.payloadUri,
    priority: input.priority ?? 'medium',
    workerCount: input.workerCount ?? 1,
    exceptionPorts: input.exceptions ?? [],
    featureSet: input.features?.length ? input.features : getDefaultFeatureIds(),
    workers: [],
    aggregate: undefined,
    timeline: buildTimeline([{ label: 'Job created', at: now }]),
    lastError: undefined
  };

  mutableJobs = [job, ...mutableJobs];
  return job;
}

export function transitionMockJob(id: string, status: JobStatus): void {
  mutableJobs = mutableJobs.map((job) => {
    if (job.id !== id) {
      return job;
    }

    const now = new Date();
    const updates: Partial<Job> = {
      status,
      updatedAt: now.toISOString(),
      timeline: buildTimeline([
        ...job.timeline.map((entry) => ({ label: entry.label, at: new Date(entry.at) })),
        { label: computeTimelineEntry(status), at: now }
      ])
    };

    if (status === 'running' && !job.startedAt) {
      updates.startedAt = now.toISOString();
    }

    if (status === 'completed') {
      updates.completedAt = now.toISOString();
      updates.aggregate = job.aggregate ?? {
        openPorts: [80, 443],
        serviceSummary: { http: 'nginx 1.24.0', tls: 'TLSv1.3' },
        webFindings: {}
      };
    }

    if (status === 'failed') {
      updates.lastError = 'Mock target unreachable during network sweep.';
    }

    return {
      ...job,
      ...updates
    };
  });
}

export function resetMockJobs(): void {
  mutableJobs = [...INITIAL_JOBS];
}

export async function authenticateMockUser(
  username: string,
  password: string
): Promise<AuthSuccess> {
  const user = MOCK_USERS.find((candidate) => candidate.username === username);
  if (!user || user.password !== password) {
    throw new ApiError(
      401,
      'Invalid credentials. Try admin/admin123 or operator/operator123 when mock mode is active.'
    );
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles,
      permissions: user.permissions
    },
    token: 'mock-session-token'
  };
}

export function getAvailableFeatures(): string[] {
  return REDMESH_FEATURE_CATALOG.map((feature) => feature.id);
}
