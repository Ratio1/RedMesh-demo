import { NextResponse } from 'next/server';
import { fetchJobs, createJob } from '@/lib/api/jobs';
import { ApiError } from '@/lib/api/errors';
import { CreateJobInput } from '@/lib/api/types';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') ?? undefined;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader ?? undefined;

  try {
    const jobs = await fetchJobs(token);
    return NextResponse.json({ jobs }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected tasks fetch error', error);
    return NextResponse.json({ message: 'Unable to load tasks.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') ?? undefined;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader ?? undefined;

  const body = await request.json().catch(() => null);

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
    notes: body.notes
  };

  try {
    const job = await createJob(payload, { authToken: token, owner: body.owner });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected task creation error', error);
    return NextResponse.json({ message: 'Unable to create task.' }, { status: 500 });
  }
}
