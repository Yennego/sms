import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';
import { getNamespacedCookie } from '@/lib/cookies';

async function getAuth() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const tenantId = await getNamespacedCookie(cookieStore, 'tenantId');
  return { accessToken, tenantId };
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { accessToken, tenantId } = await getAuth();
  if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

  const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
  const { signal, cancel } = createTimeoutSignal(30_000);
  const response = await fetch(`${baseUrl}/academics/academic-years/${params.id}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
    signal,
  });
  cancel();
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch academic year' }));
    return NextResponse.json(errorData, { status: response.status });
  }
  const data = await response.json();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { accessToken, tenantId } = await getAuth();
  if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

  const body = await request.json();
  const baseUrl2 = normalizeBaseUrl(process.env.BACKEND_API_URL);
  const { signal: s2, cancel: c2 } = createTimeoutSignal(45_000);
  const response = await fetch(`${baseUrl2}/academics/academic-years/${params.id}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: s2,
  });
  c2();
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to update academic year' }));
    return NextResponse.json(errorData, { status: response.status });
  }
  const data = await response.json();
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { accessToken, tenantId } = await getAuth();
  if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

  const baseUrl3 = normalizeBaseUrl(process.env.BACKEND_API_URL);
  const { signal: s3, cancel: c3 } = createTimeoutSignal(30_000);
  const response = await fetch(`${baseUrl3}/academics/academic-years/${params.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
    signal: s3,
  });
  c3();
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to delete academic year' }));
    return NextResponse.json(errorData, { status: response.status });
  }
  return NextResponse.json({ success: true });
}
