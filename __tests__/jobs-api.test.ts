import { fetchJobs, createJob } from '@/lib/api/jobs';
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

describe('jobs mock service', () => {
  it('returns seeded jobs when mock mode is active', async () => {
    const jobs = await fetchJobs();
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('creates a job and makes it available in subsequent fetches', async () => {
    const created = await createJob(
      {
        name: 'Test Run',
        summary: 'Smoke test job',
        target: '10.0.0.10',
        portRange: { start: 1, end: 1024 },
        payloadUri: 'r1fs://demo',
        priority: 'high',
        workerCount: 2,
        features: ['service_info_common', 'web_test_security_headers']
      },
      { owner: 'tester' }
    );

    expect(created.displayName).toBe('Test Run');
    expect(created.priority).toBe('high');
    expect(created.target).toBe('10.0.0.10');

    const jobs = await fetchJobs();
    expect(jobs.some((job) => job.id === created.id)).toBe(true);
  });
});
