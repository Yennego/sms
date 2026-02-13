import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value || null;
    const base = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(45_000);
    const resp = await fetch(`${base}/tenants/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      signal,
    });
    cancel();
    const ct = resp.headers.get('content-type') || '';
    if (resp.status === 404) {
      const minimal = { id, name: null, domain: 'unknown', isActive: true } as any;
      return NextResponse.json(minimal, { status: 200 });
    }
    const data = ct.includes('application/json') ? await resp.json().catch(()=>null) : null;
    return NextResponse.json(data, { status: resp.status });
  } catch (e: any) {
    if (e?.name === 'AbortError') return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
