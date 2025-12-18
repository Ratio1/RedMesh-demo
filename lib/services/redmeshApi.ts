import { getAppConfig } from '../config/env';
import { ApiError } from '../api/errors';
import { redmeshLogger } from './logger';
import {
  ApiResponseWrapper,
  LaunchTestRequest,
  LaunchTestResponse,
  GetJobStatusResponse,
  ListFeaturesResponse,
  FeatureCatalogResponse,
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
      timeout?: number;
    }
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (options?.params) {
      const searchParams = new URLSearchParams(options.params);
      url = `${url}?${searchParams.toString()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 30000);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    redmeshLogger.debug(`→ ${method} ${url}`);
    if (options?.body) {
      redmeshLogger.debug('Request body:', options.body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      redmeshLogger.debug(`← ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const text = await response.text();
        redmeshLogger.error(`Error response body: ${text}`);
        throw new ApiError(
          response.status,
          text || `RedMesh API request failed: ${method} ${path}`
        );
      }

      const data = await response.json() as ApiResponseWrapper<T>;
      redmeshLogger.debug('Response body:', data);

      // All API responses are wrapped in { result: T, ...metadata }
      // Check if result contains an error
      if (data.result && typeof data.result === 'object' && 'error' in data.result) {
        const errorResult = data.result as { error: string };
        redmeshLogger.error(`API error: ${errorResult.error}`);
        throw new ApiError(400, errorResult.error);
      }

      return data.result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutMs = options?.timeout ?? 30000;
        redmeshLogger.error(`Request timeout after ${timeoutMs / 1000}s: ${method} ${url}`);
        if (options?.body) {
          redmeshLogger.error('Request body was:', options.body);
        }
        throw new ApiError(504, `RedMesh API request timed out: ${method} ${path}`);
      }
      redmeshLogger.error(`Request failed: ${method} ${url}`, error);
      if (options?.body) {
        redmeshLogger.error('Request body was:', options.body);
      }
      throw error;
    }
  }

  /**
   * Start a new pentest job on the specified target.
   * The job is announced to the network and executed asynchronously by distributed workers.
   */
  async launchTest(request: LaunchTestRequest): Promise<LaunchTestResponse> {
    // Use longer timeout for launch_test as it may take time to coordinate workers
    return this.request<LaunchTestResponse>('POST', '/launch_test', {
      body: request,
      timeout: 120000, // 2 minutes
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
   * Get the feature catalog with grouped features, labels, and descriptions.
   * Returns human-readable groupings for UI display along with method names.
   */
  async getFeatureCatalog(): Promise<FeatureCatalogResponse> {
    return this.request<FeatureCatalogResponse>('GET', '/get_feature_catalog');
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