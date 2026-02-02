import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/errors';
import { getRedMeshApiService } from '@/lib/services/redmeshApi';
import { normalizeJobStatusResponse, fetchJobWithReports } from '@/lib/api/jobs';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/jobs/[jobId]
 * Retrieve the current status of a specific job.
 * Add ?includeReports=true to also fetch report content from R1FS.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ message: 'Job ID is required.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const includeReports = url.searchParams.get('includeReports') === 'true';

  try {
    if (includeReports) {
      // Fetch job with report content from R1FS
      const result = await fetchJobWithReports(jobId);

      if (!result) {
        return NextResponse.json({ message: `Job ${jobId} not found.` }, { status: 404 });
      }

      return NextResponse.json({
        job: result.job,
        reports: result.reports,
        llmAnalyses: result.llmAnalyses ?? {}
      }, { status: 200 });
    }

    // Standard job status fetch (without reports)
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
 * Stop a job using stop_monitoring with HARD stop type.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ message: 'Job ID is required.' }, { status: 400 });
  }

  try {
    const api = getRedMeshApiService();
    const result = await api.stopMonitoring({
      job_id: jobId,
      stop_type: 'HARD'
    });

    return NextResponse.json({
      status: 'success',
      job_id: result.job_id,
      monitoring_status: result.monitoring_status,
      stop_type: result.stop_type,
      passes_completed: result.passes_completed,
      message: `Job ${jobId} has been stopped.`
    }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected job stop error', error);
    return NextResponse.json({ message: 'Unable to stop job.' }, { status: 500 });
  }
}
