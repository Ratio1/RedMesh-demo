import { NextResponse } from 'next/server';
import { getNodeGeoData } from '@/lib/api/nodes';
import { ApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const data = await getNodeGeoData();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected error while loading node geo data', error);
    return NextResponse.json({ message: 'Unable to load node registry.' }, { status: 500 });
  }
}

