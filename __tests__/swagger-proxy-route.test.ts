/** @jest-environment node */

import { GET } from '@/app/api/redmesh-docs/[[...slug]]/route';
import { resetAppConfigCache } from '@/lib/config/env';

describe('redmesh docs proxy route', () => {
  const clearEnv = () => {
    delete process.env.R1EN_HOST_IP;
    delete process.env.API_PORT;
    delete process.env.EE_REDMESH_API_URL;
    delete process.env.REDMESH_API_URL;
    delete process.env.R1EN_REDMESH_API_URL;
  };

  beforeEach(() => {
    clearEnv();
    resetAppConfigCache();
  });

  afterEach(() => {
    clearEnv();
    resetAppConfigCache();
  });

  it('returns 503 when swagger is not configured', async () => {
    const response = await GET(new Request('http://localhost/api/redmesh-docs'), {
      params: { slug: [] }
    });

    expect(response.status).toBe(503);
  });

  it('proxies swagger content from the configured host and port', async () => {
    process.env.R1EN_HOST_IP = '10.0.0.5';
    process.env.API_PORT = '4040';
    resetAppConfigCache();

    const fetchSpy = jest
      .spyOn(global as any, 'fetch')
      .mockResolvedValue(
        new Response('swagger', { status: 200, headers: { 'content-type': 'text/html' } })
      );

    const response = await GET(new Request('http://localhost/api/redmesh-docs'), {
      params: { slug: [] }
    });

    expect(fetchSpy).toHaveBeenCalledWith('http://10.0.0.5:4040/docs', expect.any(Object));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('swagger');
    expect(response.headers.get('content-type')).toBe('text/html');

    fetchSpy.mockRestore();
  });

  it('rewrites swagger html so asset and openapi requests stay within the proxy', async () => {
    process.env.R1EN_HOST_IP = '10.0.0.5';
    process.env.API_PORT = '4040';
    resetAppConfigCache();

    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="/swagger-ui.css" />
          <style>body { background: url(/swagger-ui.png); }</style>
        </head>
        <body>
          <script src="/swagger-ui-bundle.js"></script>
          <script>const url = "/openapi.json";</script>
        </body>
      </html>
    `;

    jest
      .spyOn(global as any, 'fetch')
      .mockResolvedValue(new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }));

    const response = await GET(new Request('http://localhost/api/redmesh-docs'), {
      params: { slug: [] }
    });

    const rewritten = await response.text();
    expect(rewritten).toContain('href="/api/redmesh-docs/swagger-ui.css"');
    expect(rewritten).toContain('url(/api/redmesh-docs/swagger-ui.png)');
    expect(rewritten).toContain('src="/api/redmesh-docs/swagger-ui-bundle.js"');
    expect(rewritten).toContain('"/api/redmesh-docs/openapi.json"');
  });

  it('routes openapi.json requests to the api root', async () => {
    process.env.R1EN_HOST_IP = '10.0.0.5';
    process.env.API_PORT = '4040';
    resetAppConfigCache();

    const fetchSpy = jest
      .spyOn(global as any, 'fetch')
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
      );

    const response = await GET(new Request('http://localhost/api/redmesh-docs/openapi.json'), {
      params: { slug: ['openapi.json'] }
    });

    expect(fetchSpy).toHaveBeenCalledWith('http://10.0.0.5:4040/openapi.json', expect.any(Object));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});

    fetchSpy.mockRestore();
  });

  it('serves /openapi.json at the app root as a fallback', async () => {
    process.env.R1EN_HOST_IP = '10.0.0.5';
    process.env.API_PORT = '4040';
    resetAppConfigCache();

    const fetchSpy = jest
      .spyOn(global as any, 'fetch')
      .mockResolvedValue(
        new Response('{"title":"demo"}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );

    const response = await (await import('@/app/openapi.json/route')).GET(
      new Request('http://localhost/openapi.json')
    );

    expect(fetchSpy).toHaveBeenCalledWith('http://10.0.0.5:4040/openapi.json', expect.any(Object));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ title: 'demo' });
    fetchSpy.mockRestore();
  });
});
