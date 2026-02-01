import type { Job, WorkerReport, JobWorkerStatus } from '@/lib/api/types';

export interface AggregatedPortsData {
  ports: number[];
  services: Map<number, Record<string, unknown>>;
  webTests: Map<number, Record<string, unknown>>;
  totalServices: number;
  totalFindings: number;
}

export interface WorkerActivityItem {
  nodeAddress: string;
  startPort: number;
  endPort: number;
  progress: number;
  openPorts: number[];
  done: boolean;
}

export interface JobDetailContext {
  job: Job;
  reports: Record<string, WorkerReport>;
  aggregatedPorts: AggregatedPortsData;
  workerActivity: WorkerActivityItem[];
  mergedWorkers: JobWorkerStatus[];
}
