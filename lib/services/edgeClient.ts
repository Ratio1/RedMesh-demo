import createRatio1EdgeNodeClient, {
  Ratio1EdgeNodeClient
} from '@ratio1/edge-node-client';
import { getAppConfig } from '@/lib/config/env';

let cachedClient: Ratio1EdgeNodeClient | null = null;
let cachedSignature: string | null = null;

function buildSignature(
  chainstoreUrl?: string,
  r1fsUrl?: string,
  peers: string[] = []
): string {
  return [chainstoreUrl ?? '', r1fsUrl ?? '', peers.sort().join(',')].join('|');
}

export function getRatioEdgeClient(): Ratio1EdgeNodeClient {
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
    cachedClient = createRatio1EdgeNodeClient({
      cstoreUrl: config.chainstoreApiUrl,
      r1fsUrl: config.r1fsApiUrl,
      chainstorePeers: config.chainstorePeers,
      debug: config.environment !== 'production'
    });
    cachedSignature = signature;
  }

  return cachedClient;
}
