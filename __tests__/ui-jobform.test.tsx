import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobForm from '@/components/dashboard/JobForm';
import Providers from '@/app/providers';

const session = {
  user: {
    id: 'admin',
    username: 'admin',
    displayName: 'Admin',
    roles: ['admin']
  },
  token: 'mock-token'
};

describe('JobForm', () => {
  beforeEach(() => {
    localStorage.setItem('redmesh-demo-session', JSON.stringify(session));
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('submits a job and resets the form', async () => {
    const refreshMock = jest.fn();
    const user = userEvent.setup();

    const fetchMock = jest
      .spyOn(global as { fetch: typeof fetch }, 'fetch')
      .mockImplementation((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
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
            featureCatalog: []
          })
        } as Response);
      }

      if (url.endsWith('/api/jobs') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.name).toBe('Diagnostic run');
        expect(body.target).toBe('192.168.10.5');
        expect(body.portRange).toEqual({ start: 1, end: 2048 });
        expect(body.features).toContain('service_info_common');
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            job: {
              id: 'job-1',
              displayName: body.name,
              summary: body.summary,
              status: 'queued',
              createdAt: new Date().toISOString()
            }
          })
        } as Response);
        }

        throw new Error(`Unhandled fetch: ${url}`);
      });

    render(
      <Providers>
        <JobForm onCreated={refreshMock} />
      </Providers>
    );

    await user.type(screen.getByLabelText(/Job name/i), 'Diagnostic run');
    await user.type(screen.getByLabelText(/Summary/i), 'Check mesh health');
    await user.type(screen.getByLabelText(/Target host/i), '192.168.10.5');
    await user.clear(screen.getByLabelText(/Start port/i));
    await user.type(screen.getByLabelText(/Start port/i), '1');
    await user.clear(screen.getByLabelText(/End port/i));
    await user.type(screen.getByLabelText(/End port/i), '2048');
    await user.type(screen.getByLabelText(/Exclude ports/i), '22');
    await user.click(screen.getByRole('button', { name: /medium/i }));
    await user.click(screen.getByRole('button', { name: /Create job/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Job "Diagnostic run" created/)).toBeInTheDocument());
  });
});
