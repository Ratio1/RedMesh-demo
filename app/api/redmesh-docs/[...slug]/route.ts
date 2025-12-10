import { NextResponse } from 'next/server';
import { getSwaggerUrl } from '@/lib/config/env';

function joinUrl(base: string, path: string): string {
  if (!path) {
    return base;
  }

  return `${base.replace(/\/$/, '')}/${path}`;
}

export async function GET(request: Request, context: { params: { slug?: string[] } }) {
  const swaggerUrl = getSwaggerUrl();

  if (!swaggerUrl) {
    return NextResponse.json({ error: 'Swagger endpoint not configured.' }, { status: 503 });
  }

  const suffix = context.params?.slug?.join('/') ?? '';
  const search = new URL(request.url).search;
  const target = `${joinUrl(swaggerUrl, suffix)}${search}`;

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
    if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers
  });
}
