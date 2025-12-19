import type { FeatureCollection, Point } from 'geojson';
import { ApiError } from './errors';
import { getAppConfig } from '../config/env';
import { countryCodeToLngLat, countryCountsToGeoJSON } from '../gis';
import { internalNodeAddressToEthAddress } from '../utils/internalAddress';

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

async function fetchNodeLastEpoch(oraclesApiUrl: string, ethAddr: string): Promise<any | null> {
  try {
    console.log(`\n[fetchNodeLastEpoch] Fetching data for ETH address: ${ethAddr}`);
    const url = `${oraclesApiUrl}/node_last_epoch?eth_node_addr=${ethAddr}`;
    console.log(`[fetchNodeLastEpoch] URL: ${url}`);

    const response = await fetch(url, {
      cache: 'no-store'
    });

    console.log(`[fetchNodeLastEpoch] Response status: ${response.status}`);

    if (!response.ok) {
      console.log(`[fetchNodeLastEpoch] ✗ Request failed`);
      return null;
    }

    const payload = await response.json().catch(() => null);
    const result = payload?.result;

    if (result && !('error' in result)) {
      console.log(`[fetchNodeLastEpoch] ✓ Got result with tags:`, result.tags);
      console.log(`[fetchNodeLastEpoch] Node alias: ${result.node_alias}`);
      console.log(`[fetchNodeLastEpoch] Node ETH address: ${result.node_eth_address}`);
      return result;
    }

    console.log(`[fetchNodeLastEpoch] ✗ No valid result in response`);
    return null;
  } catch (error) {
    console.error(`[fetchNodeLastEpoch] ✗ Error fetching data for ${ethAddr}:`, error);
    return null;
  }
}

async function lookupEthAddressFromOracles(oraclesApiUrl: string, ratio1Address: string): Promise<string | null> {
  try {
    console.log(`\n========================================`);
    console.log(`[lookupEthAddressFromOracles] Looking up ${ratio1Address}`);
    const response = await fetch(`${oraclesApiUrl}/active_nodes_list?items_per_page=100000&page=1`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      console.log(`[lookupEthAddressFromOracles] API call failed with status ${response.status}`);
      return null;
    }

    const payload = await response.json().catch(() => null);
    const nodes = payload?.result?.nodes;

    if (!nodes || typeof nodes !== 'object') {
      console.log(`[lookupEthAddressFromOracles] No nodes in response`);
      return null;
    }

    const nodeCount = Object.keys(nodes).length;
    console.log(`[lookupEthAddressFromOracles] Found ${nodeCount} nodes in active_nodes_list`);

    // Debug: show all node addresses
    const allAddrs = Object.keys(nodes);
    console.log(`[lookupEthAddressFromOracles] All node addresses:`, JSON.stringify(allAddrs, null, 2));

    // Search for the node by ratio1 address
    let found = false;
    for (const [nodeAddr, nodeData] of Object.entries(nodes)) {
      if (nodeAddr === ratio1Address) {
        found = true;
        console.log(`[lookupEthAddressFromOracles] ✓ MATCH FOUND for ${ratio1Address}`);
        console.log(`[lookupEthAddressFromOracles] Node data type:`, typeof nodeData);
        console.log(`[lookupEthAddressFromOracles] Node data keys:`, Object.keys(nodeData || {}));
        console.log(`[lookupEthAddressFromOracles] Full node data:`, JSON.stringify(nodeData, null, 2));

        if (nodeData && typeof nodeData === 'object') {
          const ethAddr = (nodeData as any).eth_addr || (nodeData as any).node_eth_address || (nodeData as any).eth_address;
          console.log(`[lookupEthAddressFromOracles] ETH address extracted:`, ethAddr);

          if (ethAddr && typeof ethAddr === 'string') {
            console.log(`[lookupEthAddressFromOracles] ✓ Returning ETH address: ${ethAddr}`);
            console.log(`========================================\n`);
            return ethAddr;
          } else {
            console.log(`[lookupEthAddressFromOracles] ✗ Node found but no ETH address field`);
          }
        }
      }
    }

    if (!found) {
      console.log(`[lookupEthAddressFromOracles] ✗ No exact match for: ${ratio1Address}`);
      console.log(`[lookupEthAddressFromOracles] First 3 addresses for comparison:`);
      allAddrs.slice(0, 3).forEach(addr => {
        console.log(`  - "${addr}" === "${ratio1Address}" ? ${addr === ratio1Address}`);
      });
    }
    console.log(`========================================\n`);

    return null;
  } catch (error) {
    console.error(`[lookupEthAddressFromOracles] Error:`, error);
    console.log(`========================================\n`);
    return null;
  }
}

function deriveEthAddress(peer: string): string | null {
  const trimmed = peer.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return trimmed as `0x${string}`;
  }

  if (trimmed.startsWith('0xai_')) {
    try {
      return internalNodeAddressToEthAddress(trimmed);
    } catch (error) {
      // Conversion failed, will try lookup instead
      return null;
    }
  }

  return null;
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
  nodeMap?: Record<string, any>
): NodePeer[] {
  return peers.map((peer) => {
    const nodeRecord = nodeMap?.[peer];
    const coords = locatePeer(peer, nodeRecord);
    // Use alias from node record if available
    const label = nodeRecord?.node_alias || peer;
    return {
      id: peer,
      label,
      address: peer,
      kind: 'peer' as const,
      ...coords
    };
  });
}

function computeStatsFromNodes(nodes: Record<string, any>): NodeCountryStat[] {
  const grouped: Record<string, NodeCountryStat> = {};

  Object.values(nodes).forEach((node) => {
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

  try {
    let stats: NodeCountryStat[] = [];
    const peerRecords: Record<string, any> = {};

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                   getNodeGeoData - START                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('[getNodeGeoData] Oracle API URL:', config.oraclesApiUrl);
    console.log('[getNodeGeoData] Peers:', config.chainstorePeers);
    console.log('[getNodeGeoData] Total peers to process:', config.chainstorePeers.length);

    if (config.oraclesApiUrl && config.chainstorePeers.length > 0) {
      // Fetch node_last_epoch per peer from EE_CHAINSTORE_PEERS
      await Promise.all(
        config.chainstorePeers.map(async (peer, index) => {
          console.log(`\n--- Processing peer ${index + 1}/${config.chainstorePeers.length}: ${peer} ---`);

          // Try to convert ratio1 address to ETH address
          let ethAddr = deriveEthAddress(peer);

          if (ethAddr) {
            console.log(`[getNodeGeoData] ✓ Direct conversion successful: ${ethAddr}`);
          } else {
            console.log(`[getNodeGeoData] ✗ Direct conversion failed, trying lookup...`);
            ethAddr = await lookupEthAddressFromOracles(config.oraclesApiUrl as string, peer);
          }

          if (!ethAddr) {
            console.log(`[getNodeGeoData] ✗ FAILED: No ETH address found for peer: ${peer}\n`);
            return;
          }

          console.log(`[getNodeGeoData] Querying node_last_epoch for ${ethAddr}`);
          const record = await fetchNodeLastEpoch(config.oraclesApiUrl as string, ethAddr);

          if (record) {
            console.log(`[getNodeGeoData] ✓ SUCCESS: Got record for ${peer}`);
            console.log(`  - Alias: ${record.node_alias}`);
            console.log(`  - Tags: ${JSON.stringify(record.tags)}`);
            console.log(`  - ETH: ${record.node_eth_address}\n`);
            peerRecords[peer] = record;
          } else {
            console.log(`[getNodeGeoData] ✗ FAILED: No record found for ${peer}\n`);
          }
        })
      );

      // Compute stats from peer records only
      const recordCount = Object.keys(peerRecords).length;
      console.log(`\n[getNodeGeoData] Fetched ${recordCount}/${config.chainstorePeers.length} peer records`);

      if (recordCount > 0) {
        stats = computeStatsFromNodes(peerRecords);
        console.log('[getNodeGeoData] Computed stats:', JSON.stringify(stats, null, 2));
      } else {
        console.log('[getNodeGeoData] ✗ No peer records found - will show empty data');
      }
    } else {
      console.log('[getNodeGeoData] ✗ Oracle API not configured or no peers');
    }

    const peers = buildPeerList(config.chainstorePeers, peerRecords);
    const geoJson = buildPeerGeo(peers);

    // Set source to 'live' only if we successfully fetched peer records
    const source = config.oraclesApiUrl && Object.keys(peerRecords).length > 0 ? 'live' : 'mock';

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log(`║  RESULT: ${peers.length} peers | Source: ${source.toUpperCase()}  ║`);
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    return { stats, geoJson, source, peers };
  } catch (error) {
    // Fall back to empty data when live retrieval fails
    console.error('\n[getNodeGeoData] ✗ ERROR:', error);
    const peers = buildPeerList(config.chainstorePeers);
    return { stats: [], geoJson: buildPeerGeo(peers), source: 'mock', peers };
  }
}
