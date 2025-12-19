export interface AppRuntimeConfig {
  redmeshApiUrl?: string;
  oraclesApiUrl?: string;
  chainstoreApiUrl?: string;
  chainstorePeers: string[];
  r1fsApiUrl?: string;
  hostId?: string;
  hostAddr?: string;
  hostEthAddr?: string;
  mockMode: boolean;
  environment: 'development' | 'production' | 'test';
  redmeshPassword?: string;
  forceMockTasks: boolean;
  forceMockAuth: boolean;
  adminUsername: string;
  adminPassword: string;
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

function buildRedmeshApiUrl(): string | undefined {
  const host = process.env.R1EN_HOST_IP?.trim();
  const portRaw = process.env.API_PORT?.toString().trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : Number.NaN;

  if (host && Number.isInteger(port) && port > 0) {
    return normalizeUrl(`http://${host}:${port}`);
  }

  return normalizeUrl(
    process.env.EE_REDMESH_API_URL ?? process.env.REDMESH_API_URL ?? process.env.R1EN_REDMESH_API_URL
  );
}

function resolveConfig(): AppRuntimeConfig {
  console.log('Resolving application runtime configuration from environment variables.');
  console.log(process.env)
  // Prefer edge host + port to build the RedMesh URL; allow legacy variables as fallbacks.
  const redmeshApiUrl = buildRedmeshApiUrl();
  const oraclesApiUrl = normalizeUrl(
    process.env.EE_ORACLES_API_URL ??
      process.env.ORACLES_API_URL ??
      process.env.NEXT_PUBLIC_ORACLES_URL ??
      process.env.R1EN_ORACLES_API_URL ??
      "https://devnet-oracle.ratio1.ai"
  );
  const chainstoreApiUrl = normalizeUrl(process.env.EE_CHAINSTORE_API_URL);
  const r1fsApiUrl = normalizeUrl(process.env.EE_R1FS_API_URL);
  const hostId = process.env.EE_HOST_ID?.trim();
  const hostAddr = process.env.EE_HOST_ADDR?.trim();
  const hostEthAddr = process.env.EE_HOST_ETH_ADDR?.trim();
  const redmeshPassword = process.env.REDMESH_PASSWORD?.trim();
  const adminUsername = (process.env.ADMIN_USERNAME ?? 'admin').trim();
  const adminPassword = (process.env.ADMIN_PASSWORD ?? 'admin123').trim();
  const chainstorePeers = parsePeerList(
      process.env.R1EN_CHAINSTORE_PEERS || process.env.EE_CHAINSTORE_PEERS || process.env.CHAINSTORE_PEERS
  );
  const coerceBoolean = (raw: string | undefined | null, defaultValue: boolean) => {
    if (raw === undefined || raw === null) {
      return defaultValue;
    }
    const normalized = raw.toString().trim().toLowerCase();

    // Accept numeric toggles like "0" or "1".
    const numeric = Number.parseInt(normalized, 10);
    if (!Number.isNaN(numeric)) {
      return numeric !== 0;
    }

    return ['1', 'true', 'yes', 'on'].includes(normalized);
  };

  const forceMockTasks = coerceBoolean(
    process.env.EE_FORCE_MOCK_TASKS ?? process.env.FORCE_MOCK_TASKS,
    true
  );
  const forceMockAuth = coerceBoolean(
    process.env.EE_FORCE_MOCK_AUTH ?? process.env.FORCE_MOCK_AUTH,
    true
  );

  const criticalValues = [redmeshApiUrl, chainstoreApiUrl, hostId];
  const missingCritical = criticalValues.some((value) => !value);

  return {
    redmeshApiUrl,
    oraclesApiUrl,
    chainstoreApiUrl,
    chainstorePeers,
    r1fsApiUrl,
    hostId,
    hostAddr,
    hostEthAddr,
    mockMode: missingCritical,
    environment: (process.env.NODE_ENV as AppRuntimeConfig['environment']) || 'development',
    redmeshPassword,
    forceMockTasks,
    forceMockAuth,
    adminUsername,
    adminPassword
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
  console.log(config)
  if (!config.redmeshApiUrl) {
    return undefined;
  }

  return `${config.redmeshApiUrl}/docs`;
}
