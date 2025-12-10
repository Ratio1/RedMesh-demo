import type { FeatureCollection, Point } from 'geojson';
import { ApiError } from './errors';
import { getAppConfig } from '../config/env';
import { countryCodeToLngLat, countryCountsToGeoJSON } from '../gis';

export interface NodeCountryStat {
  code: string;
  count: number;
  datacenterCount: number;
  kybCount: number;
}

export interface NodeGeoResponse {
  stats: NodeCountryStat[];
  geoJson: FeatureCollection<Point, { code: string; count: number; label?: string; address?: string }>;
  source: 'live' | 'mock';
  peers: NodePeer[];
}

export interface NodePeer {
  id: string;
  label: string;
  address: string;
  kind: 'host' | 'peer';
  lat: number;
  lng: number;
  country?: string;
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

function pseudoCoordinates(seed: string): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // force 32-bit
  }

  const normalized = (value: number, min: number, max: number) => {
    const range = max - min;
    const scaled = ((value % 10000) + 10000) % 10000; // 0..9999
    return min + (scaled / 9999) * range;
  };

  return {
    lat: normalized(hash, -55, 70),
    lng: normalized(hash * 3, -170, 175)
  };
}

function buildPeerGeo(peers: NodePeer[]): FeatureCollection<
  Point,
  { code: string; count: number; label: string; address: string }
> {
  return {
    type: 'FeatureCollection',
    features: peers.map((peer) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [peer.lng, peer.lat]
      },
      properties: {
        code: peer.kind === 'host' ? 'HOST' : 'PEER',
        count: 1,
        label: peer.label,
        address: peer.address
      }
    }))
  };
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

function resolveCountry(tags?: unknown): string | null {
  const list = Array.isArray(tags) ? (tags as unknown[]) : [];
  const countryTag = list.find((tag) => typeof tag === 'string' && tag.startsWith('CT:')) as string | undefined;
  return countryTag ? countryTag.slice(3).toUpperCase() : null;
}

function locatePeer(address: string, nodeRecord?: any): { lat: number; lng: number; country?: string } {
  const countryCode = resolveCountry(nodeRecord?.tags);
  const coords = countryCode ? countryCodeToLngLat(countryCode) : null;
  const fallback = pseudoCoordinates(address);
  return {
    lat: coords ? coords[1] : fallback.lat,
    lng: coords ? coords[0] : fallback.lng,
    country: countryCode ?? undefined
  };
}

function buildPeerList(
  peers: string[],
  hostId?: string,
  hostAddr?: string,
  nodeMap?: Record<string, any>
): NodePeer[] {
  const entries: NodePeer[] = [];

  if (hostAddr || hostId) {
    const addr = hostAddr ?? hostId ?? 'host';
    const nodeRecord = nodeMap?.[addr];
    const coords = locatePeer(addr, nodeRecord);
    entries.push({
      id: hostId ?? addr,
      label: hostId ?? 'Host',
      address: addr,
      kind: 'host',
      ...coords
    });
  }

  peers.forEach((peer) => {
    const nodeRecord = nodeMap?.[peer];
    const coords = locatePeer(peer, nodeRecord);
    entries.push({
      id: peer,
      label: peer,
      address: peer,
      kind: 'peer',
      ...coords
    });
  });

  return entries;
}

export async function getNodeGeoData(): Promise<NodeGeoResponse> {
  const config = getAppConfig();

  try {
    // Build node map from oracles payload when available to enrich peer coordinates.
    let nodeMap: Record<string, any> | undefined;

    if (config.oraclesApiUrl) {
      const response = await fetch(`${config.oraclesApiUrl}/active_nodes_list?items_per_page=100000&page=1`, {
        cache: 'no-store'
      });
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        const nodes = payload?.result?.nodes;
        if (nodes && typeof nodes === 'object') {
          nodeMap = nodes as Record<string, any>;
        }
      }
    }

    const peers = buildPeerList(config.chainstorePeers, config.hostId, config.hostAddr, nodeMap);
    const stats = config.oraclesApiUrl
      ? await fetchActiveNodeStats(config.oraclesApiUrl)
      : MOCK_STATS;
    const geoJson = buildPeerGeo(peers.length ? peers : peers);
    return { stats, geoJson, source: config.oraclesApiUrl ? 'live' : 'mock', peers };
  } catch (error) {
    // Fall back to mock data when live retrieval fails so the UI still renders.
    console.error('Failed to load nodes from oracles API:', error);
    const peers = buildPeerList(config.chainstorePeers, config.hostId, config.hostAddr);
    return { stats: MOCK_STATS, geoJson: buildPeerGeo(peers), source: 'mock', peers };
  }
}
