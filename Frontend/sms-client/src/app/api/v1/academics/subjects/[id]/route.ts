import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

// Use shared normalizeBaseUrl from http lib

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
  const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
  if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

  const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
  const { signal, cancel } = createTimeoutSignal(30_000);
  const response = await fetch(`${baseUrl}/academics/subjects/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
    },
    signal,
  });
  cancel();

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch subject' }));
    return NextResponse.json(errorData, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
  const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
  if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

  const body = await request.json();
  const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
  const { signal: s2, cancel: c2 } = createTimeoutSignal(45_000);
  const response = await fetch(`${baseUrl}/academics/subjects/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: s2,
  });
  c2();

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to update subject' }));
    return NextResponse.json(errorData, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
  const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
  if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

  const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
  const { signal: s3, cancel: c3 } = createTimeoutSignal(30_000);
  const response = await fetch(`${baseUrl}/academics/subjects/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
    },
    signal: s3,
  });
  c3();

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to delete subject' }));
    return NextResponse.json(errorData, { status: response.status });
  }

  return NextResponse.json({ success: true });
}
