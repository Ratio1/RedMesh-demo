/** @jest-environment node */

import { GET } from '@/app/api/config/route';
import { resetAppConfigCache } from '@/lib/config/env';

describe('config API route', () => {
  beforeEach(() => {
    resetAppConfigCache();
  });

  afterEach(() => {
    delete process.env.EE_REDMESH_API_URL;
    delete process.env.EE_CHAINSTORE_API_URL;
    delete process.env.REDMESH_TOKEN;
    delete process.env.EE_HOST_ID;
    delete process.env.EE_R1FS_API_URL;
    resetAppConfigCache();
  });

  it('reports mock mode when env vars are missing', async () => {
    delete process.env.EE_REDMESH_API_URL;
    delete process.env.EE_CHAINSTORE_API_URL;
    delete process.env.REDMESH_TOKEN;
    delete process.env.EE_HOST_ID;
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.mockMode).toBe(true);
  });

  it('reports live mode when env vars are present', async () => {
    process.env.EE_REDMESH_API_URL = 'http://localhost:4000';
    process.env.EE_CHAINSTORE_API_URL = 'http://localhost:5000';
    process.env.REDMESH_TOKEN = 'demo';
    process.env.EE_HOST_ID = 'en-01';
    resetAppConfigCache();
    const response = await GET();
    const payload = await response.json();
    expect(payload.mockMode).toBe(false);
    expect(payload.hostId).toBe('en-01');
  });
});
