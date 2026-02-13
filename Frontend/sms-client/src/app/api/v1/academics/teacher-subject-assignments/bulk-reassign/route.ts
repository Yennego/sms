import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
        const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

        if (!accessToken) {
            return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        }
        if (!tenantId) {
            return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
        }

        const body = await request.json();

        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const { signal, cancel } = createTimeoutSignal(90_000);
        const response = await fetch(`${baseUrl}/academics/teacher-subject-assignments/bulk-reassign`, {
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
            const errorData = await response.json().catch(() => ({ message: 'Failed to bulk reassign assignments' }));
            return NextResponse.json(errorData, { status: response.status });
        }

        return NextResponse.json({ message: 'Assignments reassigned successfully' });

    } catch (error) {
        console.error('[Teacher Subject Assignments Bulk Reassign API] Error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
