/** @jest-environment node */

import { GET, POST } from '@/app/api/jobs/route';
import { resetMockJobs } from '@/lib/api/mockData';
import { resetAppConfigCache } from '@/lib/config/env';

beforeEach(() => {
  delete process.env.EE_REDMESH_API_URL;
  delete process.env.EE_CHAINSTORE_API_URL;
  delete process.env.EE_R1FS_API_URL;
  delete process.env.EE_HOST_ID;
  delete process.env.REDMESH_TOKEN;
  resetAppConfigCache();
  resetMockJobs();
});

describe('jobs API route', () => {
  it('returns jobs in mock mode', async () => {
    const response = await GET(new Request('http://localhost/api/jobs'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(Array.isArray(payload.jobs)).toBe(true);
  });

  it('creates jobs in mock mode', async () => {
    const response = await POST(
      new Request('http://localhost/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Route Test',
          summary: 'Created via API route',
          target: '10.1.1.5',
          portRange: { start: 1, end: 2048 },
          features: ['service_info_common'],
          workerCount: 1
        })
      })
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.job.displayName).toBe('Route Test');
  });
});
