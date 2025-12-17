export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type JobPriority = 'low' | 'medium' | 'high' | 'critical';

export type JobDistribution = 'slice' | 'mirror';

export type JobDuration = 'singlepass' | 'continuous';

export type JobRunMode = 'singlepass' | 'continuous';

export type JobPortOrder = 'sequential' | 'random';

export interface JobTempo {
  minSeconds: number;
  maxSeconds: number;
}

export interface JobTempoSteps {
  min: number;
  max: number;
}

export interface JobWorkerStatus {
  id: string;
  startPort: number;
  endPort: number;
  progress: number;
  done: boolean;
  canceled: boolean;
  portsScanned: number;
  openPorts: number[];
  serviceInfo: Record<string, string>;
  webTestsInfo: Record<string, string>;
  completedTests: string[];
}

export interface JobAggregateReport {
  openPorts: number[];
  serviceSummary: Record<string, string>;
  webFindings: Record<string, string>;
  notes?: string;
}

export interface JobTimelineEntry {
  label: string;
  at: string;
}

export interface PassHistoryEntry {
  passNr: number;
  completedAt: string;
  reports: Record<string, string>; // node_address -> CID mapping
}

export interface WorkerReport {
  jobId: string;
  localWorkerId: string;
  target: string;
  initiator: string;
  startPort: number;
  endPort: number;
  portsScanned: number;
  nrOpenPorts: number;
  openPorts: number[];
  exceptions: number[];
  serviceInfo: Record<string, Record<string, unknown>>;
  webTestsInfo: Record<string, Record<string, unknown>>;
  webTested: boolean;
  completedTests: string[];
  progress: string;
  done: boolean;
  canceled: boolean;
}

export interface Job {
  id: string;
  displayName: string;
  target: string;
  initiator: string;
  status: JobStatus;
  summary: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  finalizedAt?: string;
  owner?: string;
  payloadUri?: string;
  priority: JobPriority;
  workerCount: number;
  exceptionPorts: number[];
  featureSet: string[];
  excludedFeatures: string[];
  workers: JobWorkerStatus[];
  aggregate?: JobAggregateReport;
  timeline: JobTimelineEntry[];
  lastError?: string;
  distribution?: JobDistribution;
  duration?: JobDuration;
  runMode: JobRunMode;
  portOrder: JobPortOrder;
  portRange: { start: number; end: number };
  currentPass: number;
  monitorInterval?: number;
  nextPassAt?: string;
  tempo?: JobTempo;
  tempoSteps?: JobTempoSteps;
  passHistory?: PassHistoryEntry[];
}

export interface CreateJobInput {
  name: string;
  summary: string;
  target: string;
  portRange: {
    start: number;
    end: number;
  };
  exceptions?: number[];
  features?: string[];
  workerCount?: number;
  payloadUri?: string;
  priority?: JobPriority;
  notes?: string;
  distribution?: JobDistribution;
  duration?: JobDuration;
  tempo?: JobTempo;
  tempoSteps?: JobTempoSteps;
  scanDelay?: JobTempo;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions?: string[];
}

export interface AuthSuccess {
  user: UserAccount;
  token: string;
}
