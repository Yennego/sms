import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const tenantIdCookie = cookieStore.get('tn_tenantId')?.value;
    const accessTokenCookie = cookieStore.get('tn_accessToken')?.value || cookieStore.get('accessToken')?.value;

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const url = new URL(request.url);
    const backendUrl = `${baseUrl}/academics/schedules${url.search}`;

    const { signal, cancel } = createTimeoutSignal(90_000);
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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Schedules API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const tenantIdCookie = cookieStore.get('tn_tenantId')?.value;
    const accessTokenCookie = cookieStore.get('tn_accessToken')?.value || cookieStore.get('accessToken')?.value;

    const body = await request.json();
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/schedules`;

    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tenantIdCookie ? { 'X-Tenant-ID': tenantIdCookie } : {}),
        ...(accessTokenCookie ? { Authorization: `Bearer ${accessTokenCookie}` } : {}),
      },
      body: JSON.stringify(body),
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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Schedules API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

