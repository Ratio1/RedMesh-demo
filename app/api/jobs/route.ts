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

  const duration = body.duration === 'continuous' ? 'continuous' : 'singlepass';
  const distribution = body.distribution === 'mirror' ? 'mirror' : 'slice';
  const tempoMinRaw =
    body?.tempo?.minSeconds ?? body?.tempo?.min_seconds ?? body?.tempoMinSeconds ?? body?.tempo_min_seconds;
  const tempoMaxRaw =
    body?.tempo?.maxSeconds ?? body?.tempo?.max_seconds ?? body?.tempoMaxSeconds ?? body?.tempo_max_seconds;
  const tempoMin = tempoMinRaw !== undefined ? Number(tempoMinRaw) : undefined;
  const tempoMax = tempoMaxRaw !== undefined ? Number(tempoMaxRaw) : undefined;
  const tempoProvided = tempoMin !== undefined || tempoMax !== undefined;
  const tempoStepsSingleRawCandidate =
    body?.tempo?.steps ?? body?.tempoSteps ?? body?.tempo_steps ?? body?.steps;
  const tempoStepsSingleRaw =
    tempoStepsSingleRawCandidate !== null && typeof tempoStepsSingleRawCandidate === 'object'
      ? undefined
      : tempoStepsSingleRawCandidate;
  const tempoStepsMinRaw =
    body?.tempo?.steps?.min ??
    body?.tempo?.steps?.min_steps ??
    body?.tempoSteps?.min ??
    body?.tempoSteps?.min_steps ??
    body?.tempo_steps?.min ??
    body?.tempo_steps?.min_steps ??
    body?.steps?.min ??
    body?.tempo_steps_min ??
    body?.steps_min ??
    tempoStepsSingleRaw;
  const tempoStepsMaxRaw =
    body?.tempo?.steps?.max ??
    body?.tempo?.steps?.max_steps ??
    body?.tempoSteps?.max ??
    body?.tempoSteps?.max_steps ??
    body?.tempo_steps?.max ??
    body?.tempo_steps?.max_steps ??
    body?.steps?.max ??
    body?.tempo_steps_max ??
    body?.steps_max ??
    tempoStepsSingleRaw;
  const tempoStepsMin = tempoStepsMinRaw !== undefined ? Number(tempoStepsMinRaw) : undefined;
  const tempoStepsMax = tempoStepsMaxRaw !== undefined ? Number(tempoStepsMaxRaw) : undefined;
  const tempoStepsProvided = tempoStepsMin !== undefined || tempoStepsMax !== undefined;
  const tempoStepsInvalid =
    tempoStepsProvided &&
    (!Number.isInteger(tempoStepsMin) ||
      !Number.isInteger(tempoStepsMax) ||
      (tempoStepsMin ?? 0) <= 0 ||
      (tempoStepsMax ?? 0) < (tempoStepsMin ?? 0));

  if (
    (duration === 'continuous' && (!tempoMin || !tempoMax)) ||
    (tempoProvided && (!tempoMin || !tempoMax || tempoMin <= 0 || tempoMax < tempoMin)) ||
    tempoStepsInvalid
  ) {
    return NextResponse.json(
      {
        message: tempoStepsInvalid
          ? 'Tempo steps are invalid. Provide min and max whole numbers (min > 0, max >= min).'
          : 'Tempo range is invalid. Provide min and max seconds (min > 0, max >= min).'
      },
      { status: 400 }
    );
  }

  const tempo =
    tempoMin !== undefined && tempoMax !== undefined ? { minSeconds: tempoMin, maxSeconds: tempoMax } : undefined;

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
    tempo,
    tempoSteps:
      tempoStepsMin !== undefined && tempoStepsMax !== undefined
        ? { min: tempoStepsMin, max: tempoStepsMax }
        : undefined
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
