import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const body = await request.json();
    const base = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(45_000);
    const resp = await fetch(`${base}/academics/promotions/criteria/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    cancel();

    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      const text = ct.includes('application/json') ? await resp.json().catch(() => ({})) : await resp.text().catch(() => '');
      return NextResponse.json(text || { message: 'Failed to update promotion criteria' }, { status: resp.status });
    }

    const data = ct.includes('application/json') ? await resp.json() : {};
    return NextResponse.json(data);
  } catch (e: any) {
    if (e?.name === 'AbortError') return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const base = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(45_000);
    const resp = await fetch(`${base}/academics/promotions/criteria/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      signal,
    });
    cancel();

    if (!resp.ok) {
      const ct = resp.headers.get('content-type') || '';
      const text = ct.includes('application/json') ? await resp.json().catch(() => ({})) : await resp.text().catch(() => '');
      return NextResponse.json(text || { message: 'Failed to delete promotion criteria' }, { status: resp.status });
    }
    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    if (e?.name === 'AbortError') return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

