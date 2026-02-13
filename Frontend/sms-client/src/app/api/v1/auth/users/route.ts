// Method: GET
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';
import { getNamespacedCookie } from '@/lib/cookies';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;
    const tenantId = await getNamespacedCookie(cookieStore, 'tenantId');

    if (!accessToken) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const skip = url.searchParams.get('skip') ?? '0';
    const limit = url.searchParams.get('limit') ?? '100';
    const search = url.searchParams.get('search') ?? undefined;

    const params = new URLSearchParams();
    params.set('skip', skip);
    params.set('limit', limit);
    if (search) params.set('search', search);

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(`${baseUrl}/auth/users?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch users' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Users list API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    const tenantId = await getNamespacedCookie(cookieStore, 'tenantId');

    if (!accessToken) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    }

    const baseUrl2 = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal: s2, cancel: c2 } = createTimeoutSignal(90_000);
    const response = await fetch(`${baseUrl2}/auth/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: s2,
    });
    c2();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create user' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Create user API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

