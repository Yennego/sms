import { NextRequest, NextResponse } from 'next/server';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const reason = searchParams.get('reason');
    
    if (!status) {
      return NextResponse.json(
        { message: 'Status is required' },
        { status: 400 }
      );
    }
    
    // Build query string for backend API
    const queryParams = new URLSearchParams();
    queryParams.append('status', status);
    if (reason) queryParams.append('reason', reason);
    
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
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}people/students/${id}/status?${queryParams.toString()}`,
      {
        method: 'PUT',
        headers,
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating student status:', error);
    return NextResponse.json(
      { message: 'Failed to update student status' },
      { status: 500 }
    );
  }
}