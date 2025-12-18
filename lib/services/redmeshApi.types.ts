// RedMesh API Types based on REDMESH_API_SPEC.json

// All API responses are wrapped in this structure
export interface ApiResponseWrapper<T> {
  result: T;
  server_node_addr?: string;
  evm_network?: string;
  ee_node_alias?: string;
  ee_node_address?: string;
  ee_node_eth_address?: string;
  ee_node_network?: string;
  ee_node_ver?: string;
}

export type DistributionStrategy = 'SLICE' | 'MIRROR';
export type PortOrder = 'SHUFFLE' | 'SEQUENTIAL';
export type RunMode = 'SINGLEPASS' | 'CONTINUOUS_MONITORING';
export type StopType = 'SOFT' | 'HARD';
export type MonitoringStatus = 'RUNNING' | 'SCHEDULED_FOR_STOP' | 'STOPPED';

// Launch Test Request
export interface LaunchTestRequest {
  target: string;
  start_port?: number;
  end_port?: number;
  exceptions?: string;
  distribution_strategy?: DistributionStrategy;
  port_order?: PortOrder;
  excluded_features?: string[];
  run_mode?: RunMode;
  monitor_interval?: number;
  scan_min_delay?: number;
  scan_max_delay?: number;
  task_name?: string;
  task_description?: string;
}

// Worker Assignment
export interface WorkerAssignment {
  start_port: number;
  end_port: number;
  finished: boolean;
  canceled?: boolean;
  report_cid?: string | null;
  result?: unknown | null;
}

// Job Status
export type JobStatusType = 'RUNNING' | 'FINALIZED' | 'CANCELLED' | 'FAILED';

// Job Specs
export interface JobSpecs {
  job_id: string;
  target: string;
  start_port: number;
  end_port: number;
  exceptions: number[];
  launcher: string;
  launcher_alias?: string;
  date_created: number;
  date_updated: number;
  date_finalized?: number | null;
  job_status: JobStatusType;
  workers: Record<string, WorkerAssignment>;
  distribution_strategy: DistributionStrategy;
  port_order: PortOrder;
  excluded_features: string[];
  enabled_features: string[];
  run_mode: RunMode;
  monitor_interval?: number;
  monitoring_status?: MonitoringStatus;
  job_pass?: number;
  next_pass_at?: number | null;
  pass_history?: PassHistoryEntry[];
  scan_min_delay: number;
  scan_max_delay: number;
  task_name?: string;
  task_description?: string;
}

// Launch Test Response
export interface LaunchTestResponse {
  job_specs: JobSpecs;
  worker: string;
  other_jobs: Record<string, JobSpecs>;
}

// Get Job Status Response Variants
export interface JobStatusCompleted {
  job_id: string;
  target: string;
  status: 'completed';
  report: Record<string, WorkerReport>;
}

export interface JobStatusRunning {
  job_id: string;
  target: string;
  status: 'running';
  workers: Record<string, WorkerProgress>;
}

export interface JobStatusNetworkTracked {
  job_id: string;
  target: string;
  status: 'network_tracked';
  job: JobSpecs;
}

export interface JobStatusNotFound {
  job_id: string;
  status: 'not_found';
  message: string;
}

export type GetJobStatusResponse =
  | JobStatusCompleted
  | JobStatusRunning
  | JobStatusNetworkTracked
  | JobStatusNotFound;

// Worker Progress
export interface WorkerProgress {
  local_worker_id: string;
  start_port: number;
  end_port: number;
  ports_scanned: number;
  open_ports: number[];
  progress: string;
  done: boolean;
  canceled: boolean;
}

// Worker Report
export interface WorkerReport {
  job_id: string;
  local_worker_id: string;
  target: string;
  start_port: number;
  end_port: number;
  ports_scanned: number;
  open_ports: number[];
  service_info: Record<string, ServiceInfo>;
  web_tests_info: Record<string, WebTestResult>;
  completed_tests: string[];
  progress: string;
  done: boolean;
  canceled: boolean;
}

// Service Info
export interface ServiceInfo {
  banner?: string;
  service?: string;
  version?: string;
  [key: string]: unknown;
}

// Web Test Result
export interface WebTestResult {
  test: string;
  vulnerable: boolean;
  details?: string;
  [key: string]: unknown;
}

// List Features Response
export interface ListFeaturesResponse {
  features: {
    service_info: string[];
    web_test: string[];
    [category: string]: string[];
  };
}

// Feature Catalog Item (from get_feature_catalog endpoint)
export interface FeatureCatalogItem {
  id: string;
  label: string;
  description: string;
  category: 'service' | 'web';
  methods: string[];
}

// Feature Catalog Response
export interface FeatureCatalogResponse {
  catalog: FeatureCatalogItem[];
  all_methods: string[];
}

// List Jobs Response (for network and local jobs)
// This is the inner "result" content - the wrapper is handled by the API service
export type ListJobsResponse = Record<string, JobSpecs>;

// Stop and Delete Job Response
export interface StopAndDeleteJobResponse {
  status: 'success';
  job_id: string;
}

// Stop Monitoring Request
export interface StopMonitoringRequest {
  job_id: string;
  stop_type?: StopType;
}

// Pass History Entry
// Note: API returns pass_nr and reports mapping (node_address -> CID)
export interface PassHistoryEntry {
  pass_nr: number;
  completed_at: number;
  reports: Record<string, string>; // node_address -> CID mapping
}

// Stop Monitoring Response
export interface StopMonitoringResponse {
  monitoring_status: MonitoringStatus;
  stop_type: StopType;
  job_id: string;
  passes_completed: number;
  pass_history: PassHistoryEntry[];
}

// Get Report Response
export interface GetReportResponse {
  cid: string;
  report: AggregatedReport;
}

// Aggregated Report
export interface AggregatedReport {
  target: string;
  start_port: number;
  end_port: number;
  ports_scanned: number;
  open_ports: number[];
  service_info: Record<string, ServiceInfo>;
  web_tests_info: Record<string, WebTestResult>;
  completed_tests: string[];
}