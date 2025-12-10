'use client';

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import type { RedMeshFeature } from '@/lib/domain/features';

export interface ClientRuntimeConfig {
  hostId: string | null;
  mockMode: boolean;
  forceMockTasks: boolean;
  forceMockAuth: boolean;
  environment: 'development' | 'production' | 'test';
  swaggerUrl: string | null;
  redmeshApiConfigured: boolean;
  chainstoreApiConfigured: boolean;
  r1fsApiConfigured: boolean;
  featureCatalog: RedMeshFeature[];
  chainstorePeers: string[];
  cstoreStatus: unknown;
  r1fsStatus: unknown;
  cstoreError: string | null;
  r1fsError: string | null;
}

interface AppConfigContextValue {
  config: ClientRuntimeConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue | undefined>(undefined);

export function AppConfigProvider({ children }: PropsWithChildren<{}>): JSX.Element {
  const [config, setConfig] = useState<ClientRuntimeConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? 'Unable to load runtime config.');
      }

      const payload = (await response.json()) as ClientRuntimeConfig;
      setConfig(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load runtime config.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const value = useMemo<AppConfigContextValue>(
    () => ({
      config,
      loading,
      error,
      refresh: fetchConfig
    }),
    [config, loading, error, fetchConfig]
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigContextValue {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error('useAppConfig must be used within an AppConfigProvider');
  }

  return context;
}
