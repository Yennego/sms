import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

async function getAuth() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
  const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
  return { accessToken, tenantId };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { accessToken, tenantId } = await getAuth();
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/academics/semesters/${id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId },
      signal,
    });
    cancel();

    if (!response.ok) return NextResponse.json(await response.json().catch(() => ({ message: 'Failed to fetch semester' })), { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('[Semesters API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { accessToken, tenantId } = await getAuth();
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const body = await request.json();
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl}/academics/semesters/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    cancel();

    if (!response.ok) return NextResponse.json(await response.json().catch(() => ({ message: 'Failed to update semester' })), { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('[Semesters API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { accessToken, tenantId } = await getAuth();
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/academics/semesters/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId },
      signal,
    });
    cancel();

    if (!response.ok) return NextResponse.json(await response.json().catch(() => ({ message: 'Failed to delete semester' })), { status: response.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Semesters API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
