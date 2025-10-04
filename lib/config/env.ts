export interface AppRuntimeConfig {
  redmeshApiUrl?: string;
  chainstoreApiUrl?: string;
  chainstorePeers: string[];
  r1fsApiUrl?: string;
  hostId?: string;
  redmeshToken?: string;
  mockMode: boolean;
  environment: 'development' | 'production' | 'test';
}

let cachedConfig: AppRuntimeConfig | null = null;

function normalizeUrl(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, '');
  }

  return `http://${trimmed.replace(/\/$/, '')}`;
}

function parsePeerList(raw?: string | null): string[] {
  if (!raw) {
    return [];
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  try {
    // Support JSON arrays or comma separated strings.
    if (trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }

    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch (error) {
    console.warn('Unable to parse EE_CHAINSTORE_PEERS:', raw, error);
    return [];
  }
}

function resolveConfig(): AppRuntimeConfig {
  const redmeshApiUrl = normalizeUrl(process.env.EE_REDMESH_API_URL);
  const chainstoreApiUrl = normalizeUrl(process.env.EE_CHAINSTORE_API_URL);
  const r1fsApiUrl = normalizeUrl(process.env.EE_R1FS_API_URL);
  const hostId = process.env.EE_HOST_ID?.trim();
  const redmeshToken = process.env.REDMESH_TOKEN?.trim();
  const chainstorePeers = parsePeerList(
    process.env.EE_CHAINSTORE_PEERS || process.env.CHAINSTORE_PEERS
  );

  const criticalValues = [redmeshApiUrl, chainstoreApiUrl, hostId, redmeshToken];
  const missingCritical = criticalValues.some((value) => !value);

  return {
    redmeshApiUrl,
    chainstoreApiUrl,
    chainstorePeers,
    r1fsApiUrl,
    hostId,
    redmeshToken,
    mockMode: missingCritical,
    environment: (process.env.NODE_ENV as AppRuntimeConfig['environment']) || 'development'
  };
}

export function getAppConfig(): AppRuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = resolveConfig();
  return cachedConfig;
}

export function overrideAppConfig(config: Partial<AppRuntimeConfig>): void {
  cachedConfig = {
    ...resolveConfig(),
    ...config
  };
}

export function resetAppConfigCache(): void {
  cachedConfig = null;
}

export function getSwaggerUrl(): string | undefined {
  const config = getAppConfig();
  if (!config.redmeshApiUrl) {
    return undefined;
  }

  return `${config.redmeshApiUrl}/docs`;
}
