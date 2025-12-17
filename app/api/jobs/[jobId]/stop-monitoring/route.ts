import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/errors';
import { getRedMeshApiService, StopType } from '@/lib/services/redmeshApi';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/jobs/[jobId]/stop-monitoring
 * Stop continuous monitoring for a job.
 * Only applies to jobs running in CONTINUOUS_MONITORING mode.
 *
 * Body: { stop_type?: 'SOFT' | 'HARD' }
 * - SOFT: Complete current pass before stopping (default)
 * - HARD: Stop immediately
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ message: 'Job ID is required.' }, { status: 400 });
  }

  let stopType: StopType = 'SOFT';

  try {
    const body = await request.json();
    if (body?.stop_type === 'HARD' || body?.stopType === 'HARD') {
      stopType = 'HARD';
    }
  } catch {
    // Body is optional, use default SOFT stop
  }

  try {
    const api = getRedMeshApiService();
    const result = await api.stopMonitoring({
      job_id: jobId,
      stop_type: stopType
    });

    return NextResponse.json({
      job_id: result.job_id,
      monitoring_status: result.monitoring_status,
      stop_type: result.stop_type,
      passes_completed: result.passes_completed,
      pass_history: result.pass_history
    }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected stop monitoring error', error);
    return NextResponse.json({ message: 'Unable to stop monitoring.' }, { status: 500 });
  }
}
