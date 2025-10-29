import { NextResponse } from 'next/server';
import { getAppConfig, getSwaggerUrl } from '@/lib/config/env';
import { REDMESH_FEATURE_CATALOG } from '@/lib/domain/features';
import { getRatioEdgeClient } from '@/lib/services/edgeClient';

export async function GET() {
  const config = getAppConfig();
  let cstoreStatus: unknown = null;
  let r1fsStatus: unknown = null;
  let cstoreError: string | null = null;
  let r1fsError: string | null = null;

  if (config.mockMode) {
    cstoreStatus = { mode: 'mock' };
    r1fsStatus = { mode: 'mock' };
  } else {
    try {
      const client = getRatioEdgeClient();
      if (config.chainstoreApiUrl) {
        cstoreStatus = await client.cstore.getStatusFull();
      }
    } catch (error) {
      cstoreError = error instanceof Error ? error.message : 'Failed to read CStore status.';
    }

    try {
      const client = getRatioEdgeClient();
      if (config.r1fsApiUrl) {
        r1fsStatus = await client.r1fs.getStatusFull();
      }
    } catch (error) {
      r1fsError = error instanceof Error ? error.message : 'Failed to read R1FS status.';
    }
  }

  return NextResponse.json({
    hostId: config.hostId ?? null,
    mockMode: config.mockMode,
    environment: config.environment,
    swaggerUrl: getSwaggerUrl() ?? null,
    redmeshApiConfigured: Boolean(config.redmeshApiUrl),
    chainstoreApiConfigured: Boolean(config.chainstoreApiUrl),
    r1fsApiConfigured: Boolean(config.r1fsApiUrl),
    chainstorePeers: config.chainstorePeers,
    featureCatalog: REDMESH_FEATURE_CATALOG,
    cstoreStatus,
    r1fsStatus,
    cstoreError,
    r1fsError
  });
}
