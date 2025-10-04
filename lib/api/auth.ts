import { authenticateMockUser } from './mockData';
import { ApiError, ensure } from './errors';
import { AuthSuccess } from './types';
import { getAppConfig } from '../config/env';

interface RemoteAuthPayload {
  user?: {
    id?: string;
    username?: string;
    displayName?: string;
    roles?: string[];
  };
  token?: string;
  sessionToken?: string;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<AuthSuccess> {
  const config = getAppConfig();

  if (config.mockMode) {
    return authenticateMockUser(username, password);
  }

  if (!config.chainstoreApiUrl || !config.redmeshToken) {
    throw new ApiError(500, 'ChainStore API is not configured.');
  }

  const response = await fetch(`${config.chainstoreApiUrl.replace(/\/$/, '')}/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.redmeshToken}`
    },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError(401, 'Invalid credentials.');
    }

    const text = await response.text();
    throw new ApiError(response.status, text || 'Authentication request failed.');
  }

  const payload = (await response.json()) as RemoteAuthPayload | RemoteAuthPayload['user'];
  const container = payload as RemoteAuthPayload;
  const user = container.user ?? (payload as RemoteAuthPayload['user']);

  ensure(user?.username, 500, 'Authentication response missing username.');

  const normalized: AuthSuccess['user'] = {
    id: user?.id ?? user?.username ?? username,
    username: user?.username ?? username,
    displayName: user?.displayName ?? user?.username ?? username,
    roles: user?.roles ?? []
  };

  const token = container.token ?? container.sessionToken ?? config.redmeshToken;

  return {
    user: normalized,
    token
  };
}
