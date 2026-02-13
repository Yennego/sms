import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
        const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
        if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

        const base = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const { id } = await params;

        const { signal, cancel } = createTimeoutSignal(90_000);
        const resp = await fetch(`${base}/academics/promotions/status/${id}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
            signal,
        });
        cancel();

        if (!resp.ok) {
            if (resp.status === 404) return NextResponse.json(null);
            const err = await resp.json().catch(() => ({ message: 'Failed to fetch status' }));
            return NextResponse.json(err, { status: resp.status });
        }
        const data = await resp.json();
        return NextResponse.json(data);
    } catch (e: any) {
        if (e?.name === 'AbortError') return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
