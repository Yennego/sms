import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { createTimeoutSignal } from '@/app/api/_lib/http';

function normalizeBaseUrl(url?: string) {
  let baseUrl = (url?.trim() || 'http://localhost:8000/api/v1');
  if (!baseUrl.endsWith('/api/v1')) {
    baseUrl = baseUrl.replace(/\/+$/, '') + '/api/v1';
  }
  return baseUrl;
}

async function getAuth() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
  const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
  return { accessToken, tenantId };
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { accessToken, tenantId } = await getAuth();
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/academics/academic-grades/${params.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      signal,
    });
    cancel();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch grade' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('[Grades API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { accessToken, tenantId } = await getAuth();
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const body = await request.json();
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal: s2, cancel: c2 } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl}/academics/academic-grades/${params.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: s2,
    });
    c2();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to update grade' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('[Grades API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { accessToken, tenantId } = await getAuth();
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal: s3, cancel: c3 } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/academics/academic-grades/${params.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      signal: s3,
    });
    c3();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete grade' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Grades API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
