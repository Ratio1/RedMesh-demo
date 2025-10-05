import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '@/components/auth/LoginForm';
import Providers from '@/app/providers';

const replaceMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock
  })
}));

describe('LoginForm', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('authenticates with mock backend and redirects to dashboard', async () => {
    const fetchMock = jest
      .spyOn(global as { fetch: typeof fetch }, 'fetch')
      .mockImplementation((input: Parameters<typeof fetch>[0]) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.toString()
            : input.url;

        if (url.endsWith('/api/config')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              hostId: 'en-01',
              mockMode: true,
              environment: 'development',
              swaggerUrl: null,
              redmeshApiConfigured: false,
              chainstoreApiConfigured: false,
              r1fsApiConfigured: false,
              featureCatalog: [],
              chainstorePeers: [],
              cstoreStatus: { mode: 'mock' },
              r1fsStatus: { mode: 'mock' },
              cstoreError: null,
              r1fsError: null
            })
          } as Response);
        }

        if (url.endsWith('/api/auth/login')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
            user: {
              id: 'admin',
              username: 'admin',
              displayName: 'Admin User',
              roles: ['admin']
            },
            token: 'mock-token'
          })
        } as Response);
        }

        throw new Error(`Unhandled fetch: ${url}`);
      });

    const user = userEvent.setup();

    render(
      <Providers>
        <LoginForm />
      </Providers>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/config/)));

    await user.type(screen.getByLabelText(/Username/i), 'admin');
    await user.type(screen.getByLabelText(/Password/i), 'admin123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          typeof call[0] === 'string' && /\/api\/auth\/login$/.test(call[0]) && typeof call[1] === 'object'
        )
      ).toBe(true)
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'));
  });
});
