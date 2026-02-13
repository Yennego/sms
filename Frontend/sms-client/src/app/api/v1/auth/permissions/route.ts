import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(`${baseUrl}/auth/permissions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch permissions' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Permissions list API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const baseUrl2 = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal: s2, cancel: c2 } = createTimeoutSignal(90_000);
    const response = await fetch(`${baseUrl2}/auth/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: s2,
    });
    c2();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create permission' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Create permission API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

