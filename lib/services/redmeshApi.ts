import { getAppConfig } from '../config/env';
import { ApiError } from '../api/errors';
import {
  LaunchTestRequest,
  LaunchTestResponse,
  GetJobStatusResponse,
  ListFeaturesResponse,
  ListJobsResponse,
  StopAndDeleteJobResponse,
  StopMonitoringRequest,
  StopMonitoringResponse,
  GetReportResponse,
} from './redmeshApi.types';

export class RedMeshApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    const config = getAppConfig();
    const url = baseUrl ?? config.redmeshApiUrl;

    if (!url) {
      throw new Error('RedMesh API URL is not configured. Set REDMESH_API_URL environment variable.');
    }

    this.baseUrl = url;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: {
      params?: Record<string, string>;
      body?: unknown;
    }
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (options?.params) {
      const searchParams = new URLSearchParams(options.params);
      url = `${url}?${searchParams.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(
        response.status,
        text || `RedMesh API request failed: ${method} ${path}`
      );
    }

    return response.json();
  }

  /**
   * Start a new pentest job on the specified target.
   * The job is announced to the network and executed asynchronously by distributed workers.
   */
  async launchTest(request: LaunchTestRequest): Promise<LaunchTestResponse> {
    return this.request<LaunchTestResponse>('POST', '/launch_test', {
      body: request,
    });
  }

  /**
   * Retrieve the current status or final report of a pentest job.
   */
  async getJobStatus(jobId: string): Promise<GetJobStatusResponse> {
    return this.request<GetJobStatusResponse>('GET', '/get_job_status', {
      params: { job_id: jobId },
    });
  }

  /**
   * List all available scanning and testing features that can be enabled/disabled.
   */
  async listFeatures(): Promise<ListFeaturesResponse> {
    return this.request<ListFeaturesResponse>('GET', '/list_features');
  }

  /**
   * List all jobs tracked across the distributed network (from CStore).
   */
  async listNetworkJobs(): Promise<ListJobsResponse> {
    return this.request<ListJobsResponse>('GET', '/list_network_jobs');
  }

  /**
   * List jobs currently running on this specific worker node.
   */
  async listLocalJobs(): Promise<ListJobsResponse> {
    return this.request<ListJobsResponse>('GET', '/list_local_jobs');
  }

  /**
   * Immediately stop a running job and remove it from tracking.
   */
  async stopAndDeleteJob(jobId: string): Promise<StopAndDeleteJobResponse> {
    return this.request<StopAndDeleteJobResponse>('GET', '/stop_and_delete_job', {
      params: { job_id: jobId },
    });
  }

  /**
   * Stop continuous monitoring for a job.
   * Only applies to CONTINUOUS_MONITORING mode jobs.
   */
  async stopMonitoring(request: StopMonitoringRequest): Promise<StopMonitoringResponse> {
    return this.request<StopMonitoringResponse>('POST', '/stop_monitoring', {
      body: request,
    });
  }

  /**
   * Retrieve a full report from distributed storage (R1FS/IPFS) by its content identifier.
   */
  async getReport(cid: string): Promise<GetReportResponse> {
    return this.request<GetReportResponse>('GET', '/get_report', {
      params: { cid },
    });
  }
}

// Singleton instance for convenience
let instance: RedMeshApiService | null = null;

export function getRedMeshApiService(): RedMeshApiService {
  if (!instance) {
    instance = new RedMeshApiService();
  }
  return instance;
}

export function resetRedMeshApiService(): void {
  instance = null;
}

// Re-export types for convenience
export * from './redmeshApi.types';