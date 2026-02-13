import { NextRequest, NextResponse } from 'next/server';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const context = request.headers.get('x-auth-context') || 'DEFAULT';
    let tenantId: string | null = null;
    let accessToken: string | null = null;

    if (context === 'SUPER_ADMIN') {
      tenantId = request.headers.get('x-tenant-id');
      accessToken = request.headers.get('x-access-token');
    } else {
      const cookies = request.headers.get('cookie') || '';
      const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
      const tokenMatch = cookies.match(/(?:^|; )accessToken=([^;]+)|tn_accessToken=([^;]+)/);
      tenantId = tenantMatch ? tenantMatch[1] : null;
      accessToken = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;
    }

    if (!tenantId) return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
    if (!accessToken) return NextResponse.json({ error: 'Access token not found' }, { status: 401 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/sections/${id}`;
    const { signal, cancel } = createTimeoutSignal(30_000);
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
      return NextResponse.json({ error: errorText || `Backend error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const context = request.headers.get('x-auth-context') || 'DEFAULT';
    let tenantId: string | null = null;
    let accessToken: string | null = null;

    if (context === 'SUPER_ADMIN') {
      tenantId = request.headers.get('x-tenant-id');
      accessToken = request.headers.get('x-access-token');
    } else {
      const cookies = request.headers.get('cookie') || '';
      const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
      const tokenMatch = cookies.match(/(?:^|; )accessToken=([^;]+)|tn_accessToken=([^;]+)/);
      tenantId = tenantMatch ? tenantMatch[1] : null;
      accessToken = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;
    }

    if (!tenantId) return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
    if (!accessToken) return NextResponse.json({ error: 'Access token not found' }, { status: 401 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/sections/${id}`;
    const body = await request.text();
    const { signal, cancel } = createTimeoutSignal(45_000);
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      body,
      signal,
    });
    cancel();

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText || `Backend error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const context = request.headers.get('x-auth-context') || 'DEFAULT';
    let tenantId: string | null = null;
    let accessToken: string | null = null;

    if (context === 'SUPER_ADMIN') {
      tenantId = request.headers.get('x-tenant-id');
      accessToken = request.headers.get('x-access-token');
    } else {
      const cookies = request.headers.get('cookie') || '';
      const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
      const tokenMatch = cookies.match(/(?:^|; )accessToken=([^;]+)|tn_accessToken=([^;]+)/);
      tenantId = tenantMatch ? tenantMatch[1] : null;
      accessToken = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;
    }

    if (!tenantId) return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
    if (!accessToken) return NextResponse.json({ error: 'Access token not found' }, { status: 401 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/sections/${id}`;
    const { signal, cancel } = createTimeoutSignal(30_000);
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

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText || `Backend error: ${response.status}` }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
