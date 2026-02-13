import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { createTimeoutSignal } from '@/app/api/_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeBaseUrl(url?: string) {
  let baseUrl = (url?.trim() || 'http://localhost:8000/api/v1');
  if (!baseUrl.endsWith('/api/v1')) {
    baseUrl = baseUrl.replace(/\/+$/, '') + '/api/v1';
  }
  return baseUrl;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const backendUrl = `${baseUrl}/academics/timetables/${id}`;

    const { signal, cancel } = createTimeoutSignal(45_000);
    const resp = await fetch(backendUrl, {
      method: 'PUT',
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
      const errorData = await resp.json().catch(() => ({ message: 'Failed to update timetable' }));
      return NextResponse.json(errorData, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[Timetables API] Error:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;
    const tenantId =
      cookieStore.get('tenantId')?.value ||
      cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/timetables/${id}`;

    const { signal, cancel } = createTimeoutSignal(30_000);
    const resp = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ message: 'Failed to delete timetable' }));
      return NextResponse.json(errorData, { status: resp.status });
    }

    return NextResponse.json({ message: 'Timetable deleted' }, { status: 200 });
  } catch (err) {
    console.error('[Timetables API] Error:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
