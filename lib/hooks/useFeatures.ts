'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RedMeshFeature } from '@/lib/domain/features';
import { getDefaultFeatureCatalog } from '@/lib/domain/features';

interface UseFeaturesReturn {
  features: RedMeshFeature[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching available RedMesh features from the API.
 * Falls back to static catalog on error.
 */
export function useFeatures(): UseFeaturesReturn {
  const [features, setFeatures] = useState<RedMeshFeature[]>(() => getDefaultFeatureCatalog());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/features');
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to load features.');
      }

      if (Array.isArray(payload?.features) && payload.features.length > 0) {
        setFeatures(payload.features);
      }
      // If no features returned, keep the default catalog
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load features.';
      setError(message);
      // Keep existing features on error (either previous fetch or default catalog)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeatures();
  }, [fetchFeatures]);

  return {
    features,
    loading,
    error,
    refresh: fetchFeatures
  };
}
