import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

// Helper function to get namespaced cookies - now async
async function getNamespacedCookie(key: string, namespace: string = 'tn_'): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(`${namespace}${key}`)?.value;
}

// Top-level helpers added after imports
// Helper function to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to get tenant UUID by domain
async function getTenantUUIDByDomain(domain: string): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.BACKEND_API_URL}/tenants/?domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error(`Failed to fetch tenant by domain ${domain}:`, response.status);
      return null;
    }

    const data = await response.json();
    const tenants = Array.isArray(data) ? data : [data];
    return tenants.length > 0 && tenants[0].id ? tenants[0].id : null;
  } catch (error) {
    console.error('Error fetching tenant by domain:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = await getNamespacedCookie('accessToken') || cookieStore.get('accessToken')?.value;
    let tenantId = await getNamespacedCookie('tenantId') || cookieStore.get('tenantId')?.value;
    
    // Add debugging
    console.log(`[Teachers API] Retrieved tenantId from cookies: ${tenantId}`);
    console.log(`[Teachers API] All cookies:`, cookieStore.getAll().map(c => `${c.name}=${c.value}`).join(', '));
    
    if (!accessToken) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if tenantId exists
    if (!tenantId) {
      return NextResponse.json(
        { message: 'Tenant context required - no tenant ID found in cookies' },
        { status: 400 }
      );
    }
    
    // If tenantId is not a valid UUID, try to resolve it by domain
    if (tenantId && !isValidUUID(tenantId)) {
      console.log(`[Teachers API] TenantId "${tenantId}" is not a UUID, looking up by domain`);
      const resolvedTenantId = await getTenantUUIDByDomain(tenantId);
      
      if (!resolvedTenantId) {
        return NextResponse.json(
          { message: 'Invalid tenant context - could not resolve tenant UUID' },
          { status: 400 }
        );
      }
      
      tenantId = resolvedTenantId;
      console.log(`[Teachers API] Resolved tenant UUID: ${tenantId}`);
    }
    
    // Forward query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    console.log(`[Teachers API] Sending request to backend with X-Tenant-ID: ${tenantId}`);
    
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(
      `${baseUrl}/people/teachers${queryString ? `?${queryString}` : ''}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId, // Remove the || 'default' fallback
          'Content-Type': 'application/json',
        },
        signal,
      }
    );
    cancel();
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch teachers' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in teachers API route:', error);
    if (error?.name === 'AbortError') {
      return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = await getNamespacedCookie('accessToken') || cookieStore.get('accessToken')?.value;
    let tenantId = await getNamespacedCookie('tenantId') || cookieStore.get('tenantId')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // If tenantId is not a valid UUID, try to resolve it by domain
    if (tenantId && !isValidUUID(tenantId)) {
      console.log(`[Teachers API] TenantId "${tenantId}" is not a UUID, looking up by domain`);
      const resolvedTenantId = await getTenantUUIDByDomain(tenantId);
      
      if (!resolvedTenantId) {
        return NextResponse.json(
          { message: 'Invalid tenant context - could not resolve tenant UUID' },
          { status: 400 }
        );
      }
      
      tenantId = resolvedTenantId;
      console.log(`[Teachers API] Resolved tenant UUID: ${tenantId}`);
    }
    
    const body = await request.json();
    
    // Add tenant_id to the request body - this is the key fix!
    const teacherData = {
      ...body,
      tenant_id: tenantId
    };
    
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(
      `${baseUrl}/people/teachers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId || 'default',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teacherData), // Send the modified data with tenant_id
        signal,
      }
    );
    cancel();
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create teacher' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating teacher:', error);
    if (error?.name === 'AbortError') {
      return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

