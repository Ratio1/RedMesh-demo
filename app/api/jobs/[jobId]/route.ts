import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/errors';
import { getRedMeshApiService } from '@/lib/services/redmeshApi';
import { normalizeJobStatusResponse } from '@/lib/api/jobs';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/jobs/[jobId]
 * Retrieve the current status of a specific job.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ message: 'Job ID is required.' }, { status: 400 });
  }

  try {
    const api = getRedMeshApiService();
    const response = await api.getJobStatus(jobId);

    if (response.status === 'not_found') {
      return NextResponse.json({ message: `Job ${jobId} not found.` }, { status: 404 });
    }

    const job = normalizeJobStatusResponse(response);

    if (!job) {
      return NextResponse.json({ message: 'Unable to parse job status.' }, { status: 500 });
    }

    return NextResponse.json({ job }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected job status error', error);
    return NextResponse.json({ message: 'Unable to retrieve job status.' }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/[jobId]
 * Stop and delete a job.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ message: 'Job ID is required.' }, { status: 400 });
  }

  try {
    const api = getRedMeshApiService();
    const result = await api.stopAndDeleteJob(jobId);

    return NextResponse.json({
      status: result.status,
      job_id: result.job_id,
      message: `Job ${jobId} has been stopped and deleted.`
    }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected job deletion error', error);
    return NextResponse.json({ message: 'Unable to stop and delete job.' }, { status: 500 });
  }
}
