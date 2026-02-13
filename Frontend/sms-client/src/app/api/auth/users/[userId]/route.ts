import { NextRequest, NextResponse } from 'next/server';

export async function PUT(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const body = await request.json();
    const { userId } = await params;
    
    // Get authorization header
    const authorization = request.headers.get('Authorization');
    const tenantId = request.headers.get('X-Tenant-ID') || '00000000-0000-0000-0000-000000000001';
    
    if (!authorization) {
      return NextResponse.json(
        { message: 'Authorization header required' },
        { status: 401 }
      );
    }
    
    // Call backend API
    const response = await fetch(`${process.env.BACKEND_API_URL}/auth/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}