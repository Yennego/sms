import { NextRequest, NextResponse } from 'next/server';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(request: NextRequest) {
  try {
    console.log('[Grades API] Processing GET request');

    // Get authentication context
    const context = request.headers.get('x-auth-context') || 'DEFAULT';
    console.log('[Grades API] Auth context:', context);

    let tenantId: string | null = null;
    let accessToken: string | null = null;

    // Extract tenant ID and access token based on context
    if (context === 'SUPER_ADMIN') {
      tenantId = request.headers.get('x-tenant-id');
      accessToken = request.headers.get('x-access-token');
    } else if (context === 'TENANT') {
      const cookies = request.headers.get('cookie') || '';
      const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
      const tokenMatch = cookies.match(/tn_accessToken=([^;]+)/);
      tenantId = tenantMatch ? tenantMatch[1] : null;
      accessToken = tokenMatch ? tokenMatch[1] : null;
    } else {
      // DEFAULT context
      const cookies = request.headers.get('cookie') || '';
      console.log('[Grades API] All cookies:', cookies);

      const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
      const tokenMatch = cookies.match(/(?:^|; )accessToken=([^;]+)|tn_accessToken=([^;]+)/);

      tenantId = tenantMatch ? tenantMatch[1] : null;
      accessToken = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;
    }

    console.log('[Grades API] Retrieved tenantId from cookies:', tenantId);

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

    // Make request to backend with default pagination
    const params = request.nextUrl.searchParams;
    const skip = params.get('skip') ?? '0';
    const limit = params.get('limit') ?? '100';
    params.set('skip', skip);
    params.set('limit', limit);
    const qs = params.toString();
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/grades${qs ? `?${qs}` : ''}`;
    console.log('[Grades API] Sending request to backend with X-Tenant-ID:', tenantId);

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
      console.error('[Grades API] Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Grades API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Grades API] Processing POST request');
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
    const backendUrl = `${baseUrl}/academics/grades`;

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

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('[Grades API] POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

