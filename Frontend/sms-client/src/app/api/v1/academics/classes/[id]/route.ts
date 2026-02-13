import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function normalizeBaseUrl(url?: string) {
  let baseUrl = url || '';
  if (!baseUrl.endsWith('/api/v1')) {
    baseUrl = baseUrl.replace(/\/+$/, '') + '/api/v1';
  }
  return baseUrl;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const cookieStore = await cookies();
        const tenantIdCookie = cookieStore.get('tn_tenantId')?.value;
        const accessTokenCookie = cookieStore.get('tn_accessToken')?.value || cookieStore.get('accessToken')?.value;

        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const backendUrl = `${baseUrl}/academics/classes/${id}`;

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(tenantIdCookie ? { 'X-Tenant-ID': tenantIdCookie } : {}),
                ...(accessTokenCookie ? { Authorization: `Bearer ${accessTokenCookie}` } : {}),
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Backend error: ${response.status}`, detail: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Classes by ID API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies();
        const accessToken =
            cookieStore.get('accessToken')?.value ||
            cookieStore.get('tn_accessToken')?.value;
        const tenantId =
            cookieStore.get('tenantId')?.value ||
            cookieStore.get('tn_tenantId')?.value;

        if (!accessToken) {
            return NextResponse.json({ error: 'Access token not found' }, { status: 401 });
        }
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
        }

        const body = await request.json();
        const { id } = await context.params;
        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const backendUrl = `${baseUrl}/academics/classes/${id}`;

        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Backend error: ${response.status}`, detail: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Update Class API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies();
        const accessToken =
            cookieStore.get('accessToken')?.value ||
            cookieStore.get('tn_accessToken')?.value;
        const tenantId =
            cookieStore.get('tenantId')?.value ||
            cookieStore.get('tn_tenantId')?.value;

        if (!accessToken) {
            return NextResponse.json({ error: 'Access token not found' }, { status: 401 });
        }
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
        }

        const { id } = await context.params;
        const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const backendUrl = `${baseUrl}/academics/classes/${id}`;

        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Tenant-ID': tenantId,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Backend error: ${response.status}`, detail: errorText },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Delete Class API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}