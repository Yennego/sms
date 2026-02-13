import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Helper function to get namespaced cookies - now async
async function getNamespacedCookie(key: string, namespace: string = 'tn_'): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(`${namespace}${key}`)?.value;
}

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
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch tenant by domain: ${response.status}`);
      return null;
    }

    const tenants = await response.json();
    if (tenants && tenants.length > 0) {
      return tenants[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching tenant by domain:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    
    // Forward the request to the backend API with tenant header
    const tenantId = request.headers.get('X-Tenant-ID');
    const headers: HeadersInit = {};
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL}/people/students${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(backendUrl, {
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { message: 'Failed to fetch students' },
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
      console.log(`[Students API] TenantId "${tenantId}" is not a UUID, looking up by domain`);
      const resolvedTenantId = await getTenantUUIDByDomain(tenantId);
      
      if (!resolvedTenantId) {
        return NextResponse.json(
          { message: 'Invalid tenant context - could not resolve tenant UUID' },
          { status: 400 }
        );
      }
      
      tenantId = resolvedTenantId;
      console.log(`[Students API] Resolved tenant UUID: ${tenantId}`);
    }
    
    const body = await request.json();
    
    // Add tenant_id to the request body - this is the key fix!
    const studentData = {
      ...body,
      tenant_id: tenantId
    };
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/people/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify(studentData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json(
      { message: 'Failed to create student' },
      { status: 500 }
    );
  }
}