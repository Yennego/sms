import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Helper function to get namespaced cookies
function getNamespacedCookie(cookieStore: any, key: string, namespace: string = 'tn_'): string | undefined {
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
    const accessToken = getNamespacedCookie(cookieStore, 'accessToken') || cookieStore.get('accessToken')?.value;
    let tenantId = getNamespacedCookie(cookieStore, 'tenantId') || cookieStore.get('tenantId')?.value;
    
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

    // Resolve to UUID when a domain/code is provided
    if (!isValidUUID(tenantId)) {
      console.log(`[Departments API] TenantId "${tenantId}" is not a UUID, looking up by domain`);
      const resolvedTenantId = await getTenantUUIDByDomain(tenantId);
      if (!resolvedTenantId) {
        return NextResponse.json(
          { message: 'Invalid tenant context - could not resolve tenant UUID' },
          { status: 400 }
        );
      }
      tenantId = resolvedTenantId;
      console.log(`[Departments API] Resolved tenant UUID: ${tenantId}`);
    }

    console.log(`[Departments API] Making request to backend with tenant ID: ${tenantId}`);
    console.log(`[Departments API] Backend URL: ${process.env.BACKEND_API_URL}/people/teachers/departments`);
    
    const response = await fetch(
      `${process.env.BACKEND_API_URL}/people/teachers/departments`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log(`[Departments API] Backend response status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch departments' }));
      console.error(`[Departments API] Backend error:`, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
