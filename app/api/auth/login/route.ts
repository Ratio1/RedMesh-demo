import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ message: 'username and password are required.' }, { status: 400 });
  }

  try {
    const result = await authenticateUser(body.username, body.password);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('Unexpected auth error', error);
    return NextResponse.json({ message: 'Unexpected authentication error.' }, { status: 500 });
  }
}
