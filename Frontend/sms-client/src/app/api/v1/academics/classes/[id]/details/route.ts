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
        const backendUrl = `${baseUrl}/academics/classes/${id}/details`;

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
        console.error('[Class Details API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}