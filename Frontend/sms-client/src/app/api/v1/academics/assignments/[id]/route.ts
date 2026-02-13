import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = params;
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
        const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

        if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const backendUrl = `${baseUrl}/academics/assignments/${id}`;
        const { signal, cancel } = createTimeoutSignal(90_000);
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json',
            },
            signal,
        });
        cancel();

        if (!response.ok) return NextResponse.json({ message: 'Failed to fetch assignment' }, { status: response.status });
        return NextResponse.json(await response.json());
    } catch (error) {
        console.error('[Assignment Detail API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = params;
        const body = await request.json();
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
        const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

        if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const backendUrl = `${baseUrl}/academics/assignments/${id}`;
        const { signal, cancel } = createTimeoutSignal(90_000);
        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal,
        });
        cancel();

        if (!response.ok) return NextResponse.json({ message: 'Failed to update assignment' }, { status: response.status });
        return NextResponse.json(await response.json());
    } catch (error) {
        console.error('[Assignment Detail API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = params;
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
        const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

        if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const backendUrl = `${baseUrl}/academics/assignments/${id}`;
        const { signal, cancel } = createTimeoutSignal(90_000);
        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json',
            },
            signal,
        });
        cancel();

        if (!response.ok) return NextResponse.json({ message: 'Failed to delete assignment' }, { status: response.status });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('[Assignment Detail API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
