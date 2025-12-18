import createEdgeSdk, { type EdgeSdk } from '@ratio1/edge-sdk-ts';
import { getAppConfig } from '@/lib/config/env';
import type { JobSpecs, ListJobsResponse } from './redmeshApi.types';

let cachedClient: EdgeSdk | null = null;
let cachedSignature: string | null = null;

function buildSignature(
  chainstoreUrl?: string,
  r1fsUrl?: string,
  peers: string[] = []
): string {
  return [chainstoreUrl ?? '', r1fsUrl ?? '', peers.sort().join('|')].join('|');
}

export function getRatioEdgeClient(): EdgeSdk {
  const config = getAppConfig();
  const signature = buildSignature(
    config.chainstoreApiUrl,
    config.r1fsApiUrl,
    config.chainstorePeers
  );

  if (!config.chainstoreApiUrl && !config.r1fsApiUrl) {
    throw new Error('Ratio1 edge client requires ChainStore or R1FS endpoint.');
  }

  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = createEdgeSdk({
      cstoreUrl: config.chainstoreApiUrl,
      r1fsUrl: config.r1fsApiUrl,
      chainstorePeers: config.chainstorePeers,
      debug: config.environment !== 'production',
      verbose: config.environment !== 'production'
    });
    cachedSignature = signature;
  }

  return cachedClient;
}

/**
 * Extract all unique CIDs from pass_history reports across all jobs.
 */
export function extractCidsFromJobs(jobs: ListJobsResponse | Record<string, JobSpecs>): string[] {
  const cids = new Set<string>();

  for (const job of Object.values(jobs)) {
    if (job.pass_history && Array.isArray(job.pass_history)) {
      for (const pass of job.pass_history) {
        if (pass.reports && typeof pass.reports === 'object') {
          for (const cid of Object.values(pass.reports)) {
            if (typeof cid === 'string' && cid.length > 0) {
              cids.add(cid);
            }
          }
        }
      }
    }
  }

  return Array.from(cids);
}

/**
 * Raw report data from API (snake_case)
 */
interface RawWorkerReport {
  job_id?: string;
  local_worker_id?: string;
  target?: string;
  initiator?: string;
  start_port?: number;
  end_port?: number;
  ports_scanned?: number;
  nr_open_ports?: number;
  open_ports?: number[];
  exceptions?: number[];
  service_info?: Record<string, unknown>;
  web_tests_info?: Record<string, unknown>;
  web_tested?: boolean;
  completed_tests?: string[];
  progress?: string;
  done?: boolean;
  canceled?: boolean;
}

/**
 * Transform raw snake_case report to camelCase WorkerReport format
 */
function transformReport(raw: RawWorkerReport): Record<string, unknown> {
  const openPorts = raw.open_ports ?? [];
  // Use actual array length if nr_open_ports is 0 but we have open ports
  const nrOpenPorts = raw.nr_open_ports ?? openPorts.length;
  const actualNrOpenPorts = nrOpenPorts === 0 && openPorts.length > 0 ? openPorts.length : nrOpenPorts;

  return {
    jobId: raw.job_id ?? '',
    localWorkerId: raw.local_worker_id ?? '',
    target: raw.target ?? '',
    initiator: raw.initiator ?? '',
    startPort: raw.start_port ?? 0,
    endPort: raw.end_port ?? 0,
    portsScanned: raw.ports_scanned ?? 0,
    nrOpenPorts: actualNrOpenPorts,
    openPorts,
    exceptions: raw.exceptions ?? [],
    serviceInfo: raw.service_info ?? {},
    webTestsInfo: raw.web_tests_info ?? {},
    webTested: raw.web_tested ?? false,
    completedTests: raw.completed_tests ?? [],
    progress: raw.progress ?? '0%',
    done: raw.done ?? false,
    canceled: raw.canceled ?? false
  };
}

/**
 * Fetch JSON content for a single CID from R1FS via RedMesh API.
 * Uses the /get_report endpoint which retrieves content from R1FS.
 * Transforms snake_case fields to camelCase.
 */
export async function fetchReportByCid(cid: string): Promise<Record<string, unknown> | null> {
  try {
    const { getRedMeshApiService } = await import('./redmeshApi');
    const api = getRedMeshApiService();
    const result = await api.getReport(cid);
    const rawReport = result.report as unknown as RawWorkerReport;
    return transformReport(rawReport);
  } catch (error) {
    console.error(`[fetchReportByCid] Failed to fetch CID ${cid}:`, error);
    return null;
  }
}

/**
 * Fetch JSON content for multiple CIDs from R1FS.
 * Returns a mapping of { cid: json_content }.
 */
export async function fetchReportsByCids(cids: string[]): Promise<Record<string, Record<string, unknown>>> {
  const reports: Record<string, Record<string, unknown>> = {};

  const fetchPromises = cids.map(async (cid) => {
    const content = await fetchReportByCid(cid);
    if (content) {
      reports[cid] = content;
    }
  });

  await Promise.all(fetchPromises);
  return reports;
}

/**
 * Fetch jobs with their report content from R1FS.
 * Returns both the jobs data and a mapping of { cid: json_content }.
 */
export async function fetchJobsWithReports(
  jobs: ListJobsResponse | Record<string, JobSpecs>
): Promise<{
  jobs: ListJobsResponse;
  reports: Record<string, Record<string, unknown>>;
}> {
  const cids = extractCidsFromJobs(jobs);
  const reports = await fetchReportsByCids(cids);

  return {
    jobs: jobs as ListJobsResponse,
    reports
  };
}
