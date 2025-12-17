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
 * Fetch JSON content for a single CID from R1FS via RedMesh API.
 * Uses the /get_report endpoint which retrieves content from R1FS.
 */
export async function fetchReportByCid(cid: string): Promise<Record<string, unknown> | null> {
  try {
    const { getRedMeshApiService } = await import('./redmeshApi');
    const api = getRedMeshApiService();
    const result = await api.getReport(cid);
    return result.report as unknown as Record<string, unknown>;
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
