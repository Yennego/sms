import { NextRequest, NextResponse } from 'next/server';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function POST(request: NextRequest) {
    try {
        console.log('[Grades Bulk API] Processing POST request');
        const cookies = request.headers.get('cookie') || '';
        const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
        const tokenMatch = cookies.match(/(?:^|; )accessToken=([^;]+)|tn_accessToken=([^;]+)/);

        const tenantId = tenantMatch ? tenantMatch[1] : null;
        const accessToken = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;

        if (!tenantId || !accessToken) {
            return NextResponse.json({ error: 'Auth context missing' }, { status: 400 });
        }

        const body = await request.json();
        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const backendUrl = `${baseUrl}/academics/grades/bulk`;

        const { signal, cancel } = createTimeoutSignal(90_000);
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal,
        });
        cancel();

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Grades Bulk API] Backend error:', response.status, errorText);
            return NextResponse.json(
                { error: `Backend error: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('[Grades Bulk API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
