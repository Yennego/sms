import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Helper function to get namespaced cookies
function getNamespacedCookie(cookieStore: any, key: string, namespace: string = 'tn_'): string | undefined {
  return cookieStore.get(`${namespace}${key}`)?.value;
}

// Helper function to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    // Try multiple cookie namespaces
    const accessToken = getNamespacedCookie(cookieStore, 'accessToken', 'tn_') || 
                       getNamespacedCookie(cookieStore, 'accessToken', '') || 
                       cookieStore.get('accessToken')?.value;
    const tenantId = getNamespacedCookie(cookieStore, 'tenantId', 'tn_') || 
                    getNamespacedCookie(cookieStore, 'tenantId', '') || 
                    cookieStore.get('tenantId')?.value;
    
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
    
    const response = await fetch(
      `${process.env.BACKEND_API_URL}/people/teachers/${id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Teacher not found' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching teacher:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    // Try multiple cookie namespaces
    const accessToken = getNamespacedCookie(cookieStore, 'accessToken', 'tn_') || 
                       getNamespacedCookie(cookieStore, 'accessToken', '') || 
                       cookieStore.get('accessToken')?.value;
    const tenantId = getNamespacedCookie(cookieStore, 'tenantId', 'tn_') || 
                    getNamespacedCookie(cookieStore, 'tenantId', '') || 
                    cookieStore.get('tenantId')?.value;
    
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
    
    const body = await request.json();
    
    const response = await fetch(
      `${process.env.BACKEND_API_URL}/people/teachers/${id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to update teacher' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating teacher:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    // Try multiple cookie namespaces
    const accessToken = getNamespacedCookie(cookieStore, 'accessToken', 'tn_') || 
                       getNamespacedCookie(cookieStore, 'accessToken', '') || 
                       cookieStore.get('accessToken')?.value;
    const tenantId = getNamespacedCookie(cookieStore, 'tenantId', 'tn_') || 
                    getNamespacedCookie(cookieStore, 'tenantId', '') || 
                    cookieStore.get('tenantId')?.value;
    
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
    
    const response = await fetch(
      `${process.env.BACKEND_API_URL}/people/teachers/${id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete teacher' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    
    return NextResponse.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}