import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    console.log('[Classes API] Processing GET request');

    // Await the cookies() call for Next.js 15 compatibility
    const cookieStore = await cookies();

    // Try to get access token from different contexts
    const accessToken = cookieStore.get('accessToken')?.value ||
      cookieStore.get('sa_accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;

    // Check for tenantId in both DEFAULT and TENANT contexts
    let tenantId = cookieStore.get('tenantId')?.value ||
      cookieStore.get('tn_tenantId')?.value || null;
    if (!tenantId) {
      const seg = request.nextUrl.pathname.split('/')[1] || '';
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(seg)) tenantId = seg;
    }

    console.log('[Classes API] Retrieved tenantId from cookies:', tenantId);
    console.log('[Classes API] AccessToken found:', !!accessToken);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID not found' },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token not found' },
        { status: 401 }
      );
    }

    // Forward query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);

    // Make request to backend
    const backendUrl = `${baseUrl}/academics/classes${queryString ? '?' + queryString : ''}`;
    console.log('[Classes API] Sending request to backend with X-Tenant-ID:', tenantId);

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Classes API] Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Classes API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

    console.log('[Classes API] AccessToken found:', !!accessToken);
    console.log('[Classes API] TenantId found:', !!tenantId);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token not found' },
        { status: 401 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID not found' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Make request to backend
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/classes`;
    console.log('[Classes API] Creating class with X-Tenant-ID:', tenantId);

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
      console.error('[Classes API] Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[Classes API] Error:', error);
    if (error?.name === 'AbortError') {
      return NextResponse.json({ error: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

