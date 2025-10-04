import { NextResponse } from 'next/server';
import { getAppConfig, getSwaggerUrl } from '@/lib/config/env';
import { REDMESH_FEATURE_CATALOG } from '@/lib/domain/features';

export async function GET() {
  const config = getAppConfig();
  return NextResponse.json({
    hostId: config.hostId ?? null,
    mockMode: config.mockMode,
    environment: config.environment,
    swaggerUrl: getSwaggerUrl() ?? null,
    redmeshApiConfigured: Boolean(config.redmeshApiUrl),
    chainstoreApiConfigured: Boolean(config.chainstoreApiUrl),
    r1fsApiConfigured: Boolean(config.r1fsApiUrl),
    featureCatalog: REDMESH_FEATURE_CATALOG
  });
}
