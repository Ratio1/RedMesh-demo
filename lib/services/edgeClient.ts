import createEdgeSdk, { type EdgeSdk } from '@ratio1/edge-sdk-ts';
import { getAppConfig } from '@/lib/config/env';

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
