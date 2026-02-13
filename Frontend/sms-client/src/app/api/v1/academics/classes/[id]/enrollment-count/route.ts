import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const cookieStore = await cookies();
        const tenantIdCookie = cookieStore.get('tn_tenantId')?.value;
        const accessTokenCookie = cookieStore.get('tn_accessToken')?.value || cookieStore.get('accessToken')?.value;
        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const url = new URL(request.url);
        const backendUrl = `${baseUrl}/academics/classes/${id}/enrollment-count${url.search}`;

        const { signal, cancel } = createTimeoutSignal(20_000);
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(tenantIdCookie ? { 'X-Tenant-ID': tenantIdCookie } : {}),
                ...(accessTokenCookie ? { Authorization: `Bearer ${accessTokenCookie}` } : {}),
            },
            cache: 'no-store',
            signal,
        });
        cancel();

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Backend error: ${response.status}`, detail: errorText },
                { status: response.status }
            );
        }

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            return NextResponse.json(json);
        } catch {
            const num = Number(text);
            if (!Number.isNaN(num)) {
                return NextResponse.json(num);
            }
            return NextResponse.json({ error: 'Invalid backend response' }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[Class Enrollment Count API] Error:', error);
        if (error?.name === 'AbortError') {
            return NextResponse.json({ error: 'Upstream timeout' }, { status: 504 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
