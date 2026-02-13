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
        const { searchParams } = new URL(request.url);
        const enrollmentId = searchParams.get('enrollment_id');
        const scalingPoints = searchParams.get('scaling_points');
        const notes = searchParams.get('notes');

        const { signal, cancel } = createTimeoutSignal(90_000);
        const resp = await fetch(`${base}/academics/promotions/scaling?enrollment_id=${enrollmentId}&scaling_points=${scalingPoints}${notes ? `&notes=${encodeURIComponent(notes)}` : ''}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
            signal,
        });
        cancel();

        if (!resp.ok) {
            const error = await resp.json().catch(() => ({ message: 'Scaling failed' }));
            return NextResponse.json(error, { status: resp.status });
        }
        const data = await resp.json();
        return NextResponse.json(data);
    } catch (e: any) {
        if (e?.name === 'AbortError') return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
