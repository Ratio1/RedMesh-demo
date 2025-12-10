import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config/env';

export async function GET(request: Request) {
  const apiBase = getAppConfig().redmeshApiUrl?.replace(/\/$/, '');

  if (!apiBase) {
    return NextResponse.json({ error: 'Swagger endpoint not configured.' }, { status: 503 });
  }

  const search = new URL(request.url).search;
  const target = `${apiBase}/openapi.json${search}`;

  try {
    const upstream = await fetch(target, {
      headers: { accept: request.headers.get('accept') ?? '*/*' }
    });

    const headers = new Headers();
    upstream.headers.forEach((value, key) => {
      const normalized = key.toLowerCase();
      if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(normalized)) {
        headers.set(key, value);
      }
    });

    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reach RedMesh Swagger endpoint.' }, { status: 502 });
  }
}
