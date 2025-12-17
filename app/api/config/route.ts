import { NextResponse } from 'next/server';
import { getAppConfig, getSwaggerUrl } from '@/lib/config/env';
import { getDefaultFeatureCatalog, RedMeshFeature } from '@/lib/domain/features';
import { getRatioEdgeClient } from '@/lib/services/edgeClient';
import { APP_VERSION } from '@/lib/config/version';
import { getRedMeshApiService, FeatureCatalogItem } from '@/lib/services/redmeshApi';

/**
 * Transform FeatureCatalogItem from API to RedMeshFeature for UI.
 * The API format matches our UI type, just need to widen the category type.
 */
function catalogItemToFeature(item: FeatureCatalogItem): RedMeshFeature {
  return {
    id: item.id,
    label: item.label,
    description: item.description,
    category: item.category as 'service' | 'web' | 'diagnostic',
    methods: item.methods
  };
}

async function fetchDynamicFeatures(): Promise<RedMeshFeature[]> {
  try {
    const api = getRedMeshApiService();
    const response = await api.getFeatureCatalog();
    if (response.catalog && response.catalog.length > 0) {
      return response.catalog.map(catalogItemToFeature);
    }
    return getDefaultFeatureCatalog();
  } catch {
    return getDefaultFeatureCatalog();
  }
}

export async function GET() {
  const config = getAppConfig();
  let cstoreStatus: unknown = null;
  let r1fsStatus: unknown = null;
  let cstoreError: string | null = null;
  let r1fsError: string | null = null;
  let featureCatalog: RedMeshFeature[] = getDefaultFeatureCatalog();

  if (config.mockMode || config.forceMockTasks) {
    cstoreStatus = { mode: 'mock' };
    r1fsStatus = { mode: 'mock' };
  } else {
    // Fetch dynamic features from RedMesh API
    featureCatalog = await fetchDynamicFeatures();

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
    forceMockAuth: config.forceMockAuth,
    forceMockTasks: config.forceMockTasks,
    environment: config.environment,
    appVersion: APP_VERSION,
    swaggerUrl: getSwaggerUrl() ?? null,
    redmeshApiConfigured: Boolean(config.redmeshApiUrl),
    chainstoreApiConfigured: Boolean(config.chainstoreApiUrl),
    r1fsApiConfigured: Boolean(config.r1fsApiUrl),
    chainstorePeers: config.chainstorePeers,
    featureCatalog,
    cstoreStatus,
    r1fsStatus,
    cstoreError,
    r1fsError
  });
}
