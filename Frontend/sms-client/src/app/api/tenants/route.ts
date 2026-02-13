import { NextRequest, NextResponse } from 'next/server';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';
import { Tenant } from '@/types/tenant';

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');
    const domain = searchParams.get('domain');
    
    // If domain is provided and not 'undefined', try to find tenant by domain
    if (domain && domain !== 'undefined') {
      // First try to find by domain parameter
      const queryParams = new URLSearchParams();
      queryParams.append('domain', domain);
      
      // Call backend API to get tenants by domain
      const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
      const { signal, cancel } = createTimeoutSignal(45_000);
      const response = await fetch(`${baseUrl}/tenants/?${queryParams.toString()}`, {
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
          { status: 500 }
        );
      }
      
      // If the backend doesn't support domain query, we need to fetch all tenants and filter
      if (response.status === 404 || response.status === 422) {
        // Fallback: Get all tenants and filter by domain
        const baseUrl2 = normalizeBaseUrl(process.env.BACKEND_API_URL);
        const { signal: signal2, cancel: cancel2 } = createTimeoutSignal(45_000);
        const allTenantsResponse = await fetch(`${baseUrl2}/tenants/`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: signal2,
        });
        cancel2();
        
        if (!allTenantsResponse.ok) {
          return NextResponse.json(
            { message: 'Failed to fetch tenants' },
            { status: allTenantsResponse.status }
          );
        }
        
        const allTenants = await allTenantsResponse.json();
        
        // Filter tenants by domain
        const filteredTenants = allTenants.filter(
          (tenant: Tenant) => tenant.domain === domain || tenant.code === domain
        );
        
        return NextResponse.json(filteredTenants);
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        return NextResponse.json(
          { message: data.detail || 'Failed to fetch tenants' },
          { status: response.status }
        );
      }
      
      return NextResponse.json(data);
    }
    
    // Build query string for backend (original code for non-domain queries)
    const queryParams = new URLSearchParams();
    if (isActive !== null) queryParams.append('is_active', isActive);
    
    // Call backend API to get tenants
    const baseUrl3 = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal: signal3, cancel: cancel3 } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl3}/tenants/?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`, 
        'X-Tenant-ID': process.env.SUPER_ADMIN_TENANT_ID || '', 
      },
      signal: signal3,
    });
    cancel3();
    
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        { message: data.detail || 'Failed to fetch tenants' },
        { status: response.status }
      );
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.code === 'UND_ERR_HEADERS_TIMEOUT') {
      return NextResponse.json(
        { message: 'Upstream timeout' },
        { status: 504 }
      );
    }
    console.error('Tenants fetch error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Call backend API to create tenant
    const response = await fetch(`${process.env.BACKEND_API_URL}/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        { message: data.detail || 'Failed to create tenant' },
        { status: response.status }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Tenant creation error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
