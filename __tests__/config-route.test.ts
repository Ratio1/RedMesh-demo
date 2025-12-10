/** @jest-environment node */

import { GET } from '@/app/api/config/route';
import { resetAppConfigCache } from '@/lib/config/env';

jest.mock('@ratio1/edge-sdk-ts', () => {
  const mockClient = {
    cstore: {
      getStatusFull: jest.fn().mockResolvedValue({ status: 'ok' })
    },
    r1fs: {
      getStatusFull: jest.fn().mockResolvedValue({ status: 'ok' })
    }
  };

  const factory = jest.fn(() => mockClient);
  return {
    __esModule: true,
    default: factory
  };
});

const mockedFactory = require('@ratio1/edge-sdk-ts').default as jest.Mock;

describe('config API route', () => {
  beforeEach(() => {
    resetAppConfigCache();
  });

  afterEach(() => {
    delete process.env.EE_REDMESH_API_URL;
    delete process.env.REDMESH_API_URL;
    delete process.env.R1EN_REDMESH_API_URL;
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
    expect(payload.cstoreStatus).toEqual({ mode: 'mock' });
    expect(payload.r1fsStatus).toEqual({ mode: 'mock' });
  });

  it('reports live mode when env vars are present', async () => {
    process.env.EE_REDMESH_API_URL = 'http://localhost:4000';
    process.env.EE_CHAINSTORE_API_URL = 'http://localhost:5000';
    process.env.REDMESH_TOKEN = 'demo';
    process.env.EE_HOST_ID = 'en-01';
    process.env.EE_R1FS_API_URL = 'http://localhost:6000';
    resetAppConfigCache();
    const response = await GET();
    const payload = await response.json();
    expect(payload.mockMode).toBe(false);
    expect(payload.hostId).toBe('en-01');
    expect(payload.cstoreError).toBeNull();
    expect(payload.r1fsError).toBeNull();
    expect(payload.cstoreStatus).toEqual({ status: 'ok' });
    expect(payload.r1fsStatus).toEqual({ status: 'ok' });
    expect(mockedFactory).toHaveBeenCalled();
  });

  it('accepts REDMESH_API_URL as a fallback for status detection', async () => {
    process.env.REDMESH_API_URL = 'http://fallback-redmesh:4000';
    process.env.EE_CHAINSTORE_API_URL = 'http://localhost:5000';
    process.env.EE_HOST_ID = 'en-02';
    resetAppConfigCache();

    const response = await GET();
    const payload = await response.json();

    expect(payload.redmeshApiConfigured).toBe(true);
    expect(payload.mockMode).toBe(false);
  });
});
