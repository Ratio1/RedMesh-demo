import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/errors';
import { getRedMeshApiService, FeatureCatalogItem } from '@/lib/services/redmeshApi';
import { RedMeshFeature, getDefaultFeatureCatalog } from '@/lib/domain/features';
import { getAppConfig } from '@/lib/config/env';

/**
 * Transform FeatureCatalogItem from API to RedMeshFeature for UI.
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

/**
 * GET /api/features
 * List all available scanning and testing features.
 */
export async function GET() {
  const config = getAppConfig();

  // In mock mode, return the default catalog
  if (config.mockMode || config.forceMockTasks) {
    return NextResponse.json({ features: getDefaultFeatureCatalog() }, { status: 200 });
  }

  try {
    const api = getRedMeshApiService();
    const response = await api.getFeatureCatalog();

    if (response.catalog && response.catalog.length > 0) {
      const features = response.catalog.map(catalogItemToFeature);
      return NextResponse.json({ features }, { status: 200 });
    }

    // If API returns empty catalog, use default
    return NextResponse.json({ features: getDefaultFeatureCatalog() }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected features fetch error', error);
    // Fall back to default catalog on error
    return NextResponse.json({ features: getDefaultFeatureCatalog() }, { status: 200 });
  }
}
