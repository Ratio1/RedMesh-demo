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

export interface NodePeer {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  country?: string;
}

export interface ClientRuntimeConfig {
  hostId: string | null;
  mockMode: boolean;
  forceMockTasks: boolean;
  forceMockAuth: boolean;
  environment: 'development' | 'production' | 'test';
  appVersion: string;
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
  peers: NodePeer[];
  peersLoading: boolean;
  peersError: string | null;
  refreshPeers: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue | undefined>(undefined);

export function AppConfigProvider({ children }: PropsWithChildren<{}>): JSX.Element {
  const [config, setConfig] = useState<ClientRuntimeConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<NodePeer[]>([]);
  const [peersLoading, setPeersLoading] = useState<boolean>(true);
  const [peersError, setPeersError] = useState<string | null>(null);

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

  const fetchPeers = useCallback(async () => {
    setPeersLoading(true);
    setPeersError(null);
    try {
      const response = await fetch('/api/nodes', { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? 'Unable to load worker nodes.');
      }

      const payload = await response.json();
      if (payload?.peers && Array.isArray(payload.peers)) {
        console.log('Fetched peers:', payload.peers);
        // Map to our NodePeer type (without kind field)
        const mappedPeers: NodePeer[] = payload.peers.map((p: Record<string, unknown>) => ({
          id: String(p.id ?? ''),
          label: String(p.label ?? ''),
          address: String(p.address ?? ''),
          lat: Number(p.lat ?? 0),
          lng: Number(p.lng ?? 0),
          country: p.country ? String(p.country) : undefined
        }));
        setPeers(mappedPeers);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load worker nodes.';
      setPeersError(message);
    } finally {
      setPeersLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  // Fetch peers after config is loaded
  useEffect(() => {
    if (!loading && config) {
      void fetchPeers();
    }
  }, [loading, config, fetchPeers]);

  const value = useMemo<AppConfigContextValue>(
    () => ({
      config,
      loading,
      error,
      refresh: fetchConfig,
      peers,
      peersLoading,
      peersError,
      refreshPeers: fetchPeers
    }),
    [config, loading, error, fetchConfig, peers, peersLoading, peersError, fetchPeers]
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
