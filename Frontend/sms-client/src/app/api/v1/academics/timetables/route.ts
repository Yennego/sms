import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;
    const tenantId =
      cookieStore.get('tenantId')?.value ||
      cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const qs = request.nextUrl.searchParams.toString();
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/timetables${qs ? `?${qs}` : ''}`;
    console.log('[Timetables API] Base URL:', baseUrl);
    console.log('[Timetables API] Backend URL:', backendUrl);

    const { signal, cancel } = createTimeoutSignal(90_000);

    const resp = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ message: 'Failed to fetch timetables' }));
      return NextResponse.json(errorData, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[Timetables API] Error:', err);
    if (err?.name === 'AbortError') {
      return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;
    const tenantId =
      cookieStore.get('tenantId')?.value ||
      cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const body = await request.json();
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/timetables`;
    console.log('[Timetables API] Base URL:', baseUrl);
    console.log('[Timetables API] Backend URL:', backendUrl);

    const { signal, cancel } = createTimeoutSignal(90_000);
    const resp = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    cancel();

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ message: 'Failed to create timetable' }));
      return NextResponse.json(errorData, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('[Timetables API] Error:', err);
    if (err?.name === 'AbortError') {
      return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
