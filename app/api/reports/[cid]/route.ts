import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/errors';
import { getRedMeshApiService } from '@/lib/services/redmeshApi';

interface RouteParams {
  params: Promise<{ cid: string }>;
}

/**
 * GET /api/reports/[cid]
 * Retrieve a full report from distributed storage by its content identifier (CID).
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { cid } = await params;

  if (!cid || typeof cid !== 'string') {
    return NextResponse.json({ message: 'Report CID is required.' }, { status: 400 });
  }

  try {
    const api = getRedMeshApiService();
    const response = await api.getReport(cid);

    return NextResponse.json({
      cid: response.cid,
      report: response.report
    }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected report fetch error', error);
    return NextResponse.json({ message: 'Unable to retrieve report.' }, { status: 500 });
  }
}
