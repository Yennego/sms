import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getNamespacedCookie } from '@/lib/cookies';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;
    let tenantId =
      (await getNamespacedCookie(cookieStore, 'tenantId')) ||
      cookieStore.get('tn_tenantId')?.value ||
      cookieStore.get('tenantId')?.value || null;
    if (!tenantId) {
      const seg = request.nextUrl.pathname.split('/')[1] || '';
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(seg)) tenantId = seg;
    }

    if (!accessToken) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 400 }
      );
    }

    // Forward query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();

    console.log(`[Academic Years API] Sending request to backend with X-Tenant-ID: ${tenantId}`);

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(90_000);
    const target = `${baseUrl}/academics/academic-years${queryString ? `?${queryString}` : ''}`;
    console.log('[Academic Years API] Base URL:', baseUrl);
    console.log('[Academic Years API] Backend URL:', target);
    const response = await fetch(
      target,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        signal,
      }
    );
    cancel();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch academic years' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in academic years API route:', error);
    if (error?.name === 'AbortError') {
      return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add: Create Academic Year
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value || null;
    const tenantId = await getNamespacedCookie(cookieStore, 'tenantId');

    if (!accessToken) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(
      `${baseUrl}/academics/academic-years`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      }
    );
    cancel();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create academic year' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in academic years API route (POST):', error);
    if (error?.name === 'AbortError') {
      return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

