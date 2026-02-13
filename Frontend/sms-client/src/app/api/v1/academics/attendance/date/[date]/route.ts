import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';
import { getNamespacedCookie } from '@/lib/cookies';

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    const tenantId = await getNamespacedCookie(cookieStore, 'tenantId');
    
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
    
    // Get the date parameter
    const { date } = params;
    
    // Forward query parameters (like class_id)
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    console.log(`[Attendance API] Sending request to backend for date: ${date} with X-Tenant-ID: ${tenantId}`);
    
    // Check if class_id is provided to determine which backend endpoint to use
    const classId = searchParams.get('class_id');
    let backendEndpoint;
    
    if (classId) {
      const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
      backendEndpoint = `${baseUrl}/academics/attendance/class/${classId}/date/${date}`;
    } else {
      // For general attendance by date, we might need to create a new backend endpoint
      // For now, return an error asking for class_id
      return NextResponse.json(
        { message: 'class_id parameter is required for attendance queries' },
        { status: 400 }
      );
    }
    
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(backendEndpoint, {
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
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to fetch attendance data' 
      }));
      return NextResponse.json(errorData, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[Attendance API] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
