import { NextResponse } from 'next/server';
import { fetchJobs, createJob } from '@/lib/api/jobs';
import { ApiError } from '@/lib/api/errors';
import { CreateJobInput } from '@/lib/api/types';
import { jobsLogger } from '@/lib/services/logger';

export async function GET(request: Request) {
  jobsLogger.debug('GET /api/jobs - Request received');

  const authHeader = request.headers.get('authorization') ?? undefined;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader ?? undefined;

  try {
    const jobs = await fetchJobs(token);
    jobsLogger.debug(`Fetched ${jobs.length} jobs`);
    return NextResponse.json({ jobs }, { status: 200 });
  } catch (error) {
    jobsLogger.error('fetchJobs error:', error instanceof Error ? error.message : error);
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected tasks fetch error', error);
    return NextResponse.json({ message: 'Unable to load tasks.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  jobsLogger.debug('POST /api/jobs - Request received');

  const authHeader = request.headers.get('authorization') ?? undefined;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader ?? undefined;

  const body = await request.json().catch(() => null);
  jobsLogger.debug('Request body:', body);

  if (!body || typeof body.name !== 'string' || typeof body.summary !== 'string') {
    return NextResponse.json({ message: 'Task name and summary are required.' }, { status: 400 });
  }

  if (typeof body.target !== 'string' || !body.target.trim()) {
    return NextResponse.json({ message: 'Target must be provided.' }, { status: 400 });
  }

  const portStart = Number(body?.portRange?.start ?? body?.portStart);
  const portEnd = Number(body?.portRange?.end ?? body?.portEnd);

  if (Number.isNaN(portStart) || Number.isNaN(portEnd) || portStart < 1 || portEnd > 65535) {
    return NextResponse.json({ message: 'Port range is invalid.' }, { status: 400 });
  }

  if (portEnd < portStart) {
    return NextResponse.json({ message: 'End port must be greater than start port.' }, { status: 400 });
  }

  const exceptions: number[] = Array.isArray(body.exceptions)
    ? body.exceptions
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value) && value >= 1 && value <= 65535)
    : [];

  const features: string[] = Array.isArray(body.features)
    ? body.features.filter((value: unknown) => typeof value === 'string')
    : undefined;

  const duration = body.duration === 'continuous' ? 'continuous' : 'singlepass';
  const distribution = body.distribution === 'mirror' ? 'mirror' : 'slice';

  // Parse scan delay (dune sand walking) - accepts both scanDelay and tempo for backwards compatibility
  const scanDelayMinRaw =
    body?.scanDelay?.minSeconds ?? body?.scanDelay?.min_seconds ??
    body?.scan_delay?.minSeconds ?? body?.scan_delay?.min_seconds ??
    body?.tempo?.minSeconds ?? body?.tempo?.min_seconds;
  const scanDelayMaxRaw =
    body?.scanDelay?.maxSeconds ?? body?.scanDelay?.max_seconds ??
    body?.scan_delay?.maxSeconds ?? body?.scan_delay?.max_seconds ??
    body?.tempo?.maxSeconds ?? body?.tempo?.max_seconds;
  const scanDelayMin = scanDelayMinRaw !== undefined ? Number(scanDelayMinRaw) : undefined;
  const scanDelayMax = scanDelayMaxRaw !== undefined ? Number(scanDelayMaxRaw) : undefined;
  const scanDelayProvided = scanDelayMin !== undefined || scanDelayMax !== undefined;

  if (scanDelayProvided && (!scanDelayMin || !scanDelayMax || scanDelayMin <= 0 || scanDelayMax < scanDelayMin)) {
    return NextResponse.json(
      { message: 'Scan delay values are invalid. Provide min and max seconds (min > 0, max >= min).' },
      { status: 400 }
    );
  }

  const scanDelay =
    scanDelayMin !== undefined && scanDelayMax !== undefined
      ? { minSeconds: scanDelayMin, maxSeconds: scanDelayMax }
      : undefined;

  const payload: CreateJobInput = {
    name: body.name,
    summary: body.summary,
    target: body.target,
    portRange: {
      start: portStart,
      end: portEnd
    },
    exceptions,
    features,
    workerCount: Number(body.workerCount) || undefined,
    payloadUri: body.payloadUri,
    priority: body.priority,
    notes: body.notes,
    distribution,
    duration,
    scanDelay
  };

  jobsLogger.debug('Calling createJob with payload:', payload);

  try {
    const job = await createJob(payload, { authToken: token, owner: body.owner });
    jobsLogger.debug('Job created successfully:', job);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    jobsLogger.error('createJob error:', error instanceof Error ? error.message : error);
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected task creation error', error);
    return NextResponse.json({ message: 'Unable to create task.' }, { status: 500 });
  }
}
