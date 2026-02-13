import { NextRequest, NextResponse } from 'next/server';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const domain = searchParams.get('domain');
    
    if (!domain) {
      return NextResponse.json(
        { message: 'Domain parameter is required' },
        { status: 400 }
      );
    }
    
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const cookieStore = await cookies();
    const cookieTenantId = cookieStore.get('tn_tenantId')?.value || cookieStore.get('tenantId')?.value || '';
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(cookieTenantId)) {
      const { signal: s1, cancel: c1 } = createTimeoutSignal(45_000);
      const respById = await fetch(`${baseUrl}/tenants/${cookieTenantId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: s1,
      });
      c1();
      if (respById.ok) {
        const data = await respById.json();
        return NextResponse.json(data);
      }
    }
    const { signal, cancel } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl}/tenants/by-domain/?domain=${domain}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();
    
    // Check content type before parsing as JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response received from backend:', await response.text());
      return NextResponse.json(
        { message: 'Backend returned non-JSON response. Please check if the backend server is running.' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // If the backend doesn't support by-domain endpoint, fallback to the existing implementation
    if (response.status === 404) {
      // Fallback: Use the existing tenant API with domain query parameter
      return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants/?domain=${domain}`)
        .then(res => res.json())
        .then(data => NextResponse.json(data));
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        { message: data.detail || 'Failed to fetch tenant' },
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.code === 'UND_ERR_HEADERS_TIMEOUT') {
      return NextResponse.json(
        { message: 'Upstream timeout' },
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.error('Tenant fetch error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
