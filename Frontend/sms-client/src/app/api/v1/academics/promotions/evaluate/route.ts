import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const base = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const payload = await request.json();
    const { signal, cancel } = createTimeoutSignal(90_000);
    const resp = await fetch(`${base}/academics/promotions/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    cancel();

    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      const text = ct.includes('application/json') ? await resp.json().catch(() => ({})) : await resp.text().catch(() => '');
      return NextResponse.json(text || { message: 'Failed to evaluate promotion' }, { status: resp.status });
    }
    const data = ct.includes('application/json') ? await resp.json() : [];
    return NextResponse.json(data);
  } catch (e: any) {
    if (e?.name === 'AbortError') return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}


