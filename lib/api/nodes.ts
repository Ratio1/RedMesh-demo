import type { FeatureCollection, Point } from 'geojson';
import { ApiError } from './errors';
import { getAppConfig } from '../config/env';
import { countryCountsToGeoJSON } from '../gis';

export interface NodeCountryStat {
  code: string;
  count: number;
  datacenterCount: number;
  kybCount: number;
}

export interface NodeGeoResponse {
  stats: NodeCountryStat[];
  geoJson: FeatureCollection<Point, { code: string; count: number }>;
  source: 'live' | 'mock';
}

const MOCK_STATS: NodeCountryStat[] = [
  { code: 'US', count: 18, datacenterCount: 6, kybCount: 9 },
  { code: 'RO', count: 7, datacenterCount: 2, kybCount: 4 },
  { code: 'FR', count: 5, datacenterCount: 1, kybCount: 3 },
  { code: 'DE', count: 5, datacenterCount: 1, kybCount: 3 },
  { code: 'GB', count: 4, datacenterCount: 1, kybCount: 2 },
  { code: 'SG', count: 3, datacenterCount: 1, kybCount: 2 },
  { code: 'JP', count: 3, datacenterCount: 1, kybCount: 1 },
  { code: 'IN', count: 3, datacenterCount: 1, kybCount: 1 },
  { code: 'BR', count: 3, datacenterCount: 1, kybCount: 1 },
  { code: 'ZA', count: 2, datacenterCount: 1, kybCount: 1 }
];

function buildGeoJson(stats: NodeCountryStat[]): FeatureCollection<Point, { code: string; count: number }> {
  return countryCountsToGeoJSON(stats.map(({ code, count }) => ({ code, count })));
}

function deriveCountryCode(tags?: unknown): string {
  const list = Array.isArray(tags) ? (tags as unknown[]) : [];
  const countryTag = list.find((tag) => typeof tag === 'string' && tag.startsWith('CT:')) as string | undefined;
  return countryTag ? countryTag.slice(3).toUpperCase() : 'UN';
}

function hasTagPrefix(tags: unknown, prefix: string): boolean {
  return Array.isArray(tags) && tags.some((tag) => typeof tag === 'string' && tag.startsWith(prefix));
}

function hasTag(tags: unknown, value: string): boolean {
  return Array.isArray(tags) && tags.some((tag) => typeof tag === 'string' && tag.includes(value));
}

async function fetchActiveNodeStats(oraclesApiUrl: string): Promise<NodeCountryStat[]> {
  const response = await fetch(`${oraclesApiUrl}/active_nodes_list?items_per_page=100000&page=1`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || 'Unable to load node registry.');
  }

  const payload = await response.json();
  const nodes = payload?.result?.nodes;
  if (!nodes || typeof nodes !== 'object') {
    throw new ApiError(500, 'Node registry payload is malformed.');
  }

  const grouped: Record<string, NodeCountryStat> = {};

  Object.values(nodes as Record<string, any>).forEach((node) => {
    const code = deriveCountryCode(node?.tags);
    if (!grouped[code]) {
      grouped[code] = { code, count: 0, datacenterCount: 0, kybCount: 0 };
    }
    grouped[code].count += 1;
    if (hasTagPrefix(node?.tags, 'DC:')) {
      grouped[code].datacenterCount += 1;
    }
    if (hasTag(node?.tags, 'KYB')) {
      grouped[code].kybCount += 1;
    }
  });

  return Object.values(grouped).sort((a, b) => b.count - a.count);
}

export async function getNodeGeoData(): Promise<NodeGeoResponse> {
  const config = getAppConfig();

  if (!config.oraclesApiUrl) {
    return { stats: MOCK_STATS, geoJson: buildGeoJson(MOCK_STATS), source: 'mock' };
  }

  try {
    const stats = await fetchActiveNodeStats(config.oraclesApiUrl);
    return { stats, geoJson: buildGeoJson(stats), source: 'live' };
  } catch (error) {
    // Fall back to mock data when live retrieval fails so the UI still renders.
    console.error('Failed to load nodes from oracles API:', error);
    return { stats: MOCK_STATS, geoJson: buildGeoJson(MOCK_STATS), source: 'mock' };
  }
}

