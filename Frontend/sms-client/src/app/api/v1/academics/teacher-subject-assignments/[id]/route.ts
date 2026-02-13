import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[Teacher Subject Assignments API] Processing GET request for assignment:', id);
    
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

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

    console.log(`[Teacher Subject Assignments API] Sending GET request to backend with X-Tenant-ID: ${tenantId}`);
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/academics/teacher-subject-assignments/${id}`,
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
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to fetch assignment' 
      }));
      console.error('[Teacher Subject Assignments API] Backend error:', response.status, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log('[Teacher Subject Assignments API] Successfully fetched assignment');
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Teacher Subject Assignments API] Error:', error);
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
    console.log('[Teacher Subject Assignments API] Processing PUT request for assignment:', id);
    
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

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

    // Get request body
    const body = await request.json();

    console.log(`[Teacher Subject Assignments API] Sending PUT request to backend with X-Tenant-ID: ${tenantId}`);
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl}/academics/teacher-subject-assignments/${id}`,
      {
        method: 'PUT',
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
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to update assignment' 
      }));
      console.error('[Teacher Subject Assignments API] Backend error:', response.status, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log('[Teacher Subject Assignments API] Successfully updated assignment');
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Teacher Subject Assignments API] Error:', error);
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
    console.log('[Teacher Subject Assignments API] Processing DELETE request for assignment:', id);
    
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

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

    console.log(`[Teacher Subject Assignments API] Sending DELETE request to backend with X-Tenant-ID: ${tenantId}`);
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/academics/teacher-subject-assignments/${id}`,
      {
        method: 'DELETE',
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
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to delete assignment' 
      }));
      console.error('[Teacher Subject Assignments API] Backend error:', response.status, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    console.log('[Teacher Subject Assignments API] Successfully deleted assignment');
    return NextResponse.json({ message: 'Assignment deleted successfully' });

  } catch (error) {
    console.error('[Teacher Subject Assignments API] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
