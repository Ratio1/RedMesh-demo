import { authenticateUser } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import { resetAppConfigCache } from '@/lib/config/env';

beforeEach(() => {
  delete process.env.EE_REDMESH_API_URL;
  delete process.env.EE_CHAINSTORE_API_URL;
  delete process.env.EE_R1FS_API_URL;
  delete process.env.EE_HOST_ID;
  delete process.env.REDMESH_TOKEN;
  resetAppConfigCache();
});

describe('authenticateUser', () => {
  it('returns a mock user when runtime is not configured', async () => {
    const result = await authenticateUser('admin', 'admin123');
    expect(result.user.username).toBe('admin');
    expect(result.token).toBe('mock-session-token');
  });

  it('throws an ApiError for invalid credentials', async () => {
    await expect(authenticateUser('admin', 'wrong')).rejects.toBeInstanceOf(ApiError);
  });
});
