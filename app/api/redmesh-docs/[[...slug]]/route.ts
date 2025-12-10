import { NextResponse } from 'next/server';
import { getAppConfig, getSwaggerUrl } from '@/lib/config/env';

const PROXY_BASE = '/api/redmesh-docs';

function joinUrl(base: string, path: string): string {
  if (!path) {
    return base;
  }

  return `${base.replace(/\/$/, '')}/${path}`;
}

function rewriteHtmlForProxy(html: string): string {
  return html
    .replace(/href="\//g, `href="${PROXY_BASE}/`)
    .replace(/href='\//g, `href='${PROXY_BASE}/`)
    .replace(/src="\//g, `src="${PROXY_BASE}/`)
    .replace(/src='\//g, `src='${PROXY_BASE}/`)
    .replace(/url\(\//g, `url(${PROXY_BASE}/`)
    .replace(/(["'])\/openapi\.json\1/g, `$1${PROXY_BASE}/openapi.json$1`);
}

export async function GET(request: Request, context: { params: { slug?: string[] } }) {
  const swaggerUrl = getSwaggerUrl();
  const apiBase = getAppConfig().redmeshApiUrl?.replace(/\/$/, '');

  if (!swaggerUrl || !apiBase) {
    return NextResponse.json({ error: 'Swagger endpoint not configured.' }, { status: 503 });
  }

  const suffix = context.params?.slug?.join('/') ?? '';
  const search = new URL(request.url).search;
  const target =
    suffix === 'openapi.json'
      ? `${apiBase}/openapi.json${search}`
      : `${joinUrl(swaggerUrl, suffix)}${search}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        accept: request.headers.get('accept') ?? '*/*'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reach RedMesh Swagger endpoint.' },
      { status: 502 }
    );
  }

  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(normalized)) {
      headers.set(key, value);
    }
  });

  const contentType = upstream.headers.get('content-type') || '';

  if (contentType.includes('text/html')) {
    const rewritten = rewriteHtmlForProxy(await upstream.text());
    headers.set('content-type', contentType);
    return new NextResponse(rewritten, {
      status: upstream.status,
      headers
    });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers
  });
}
