import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    
    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-ID');
    
    if (!tenantId) {
      return NextResponse.json(
        { message: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    // Call backend API
    const response = await fetch(`${process.env.BACKEND_API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({ email }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        { message: data.detail || 'Failed to process request' },
        { status: response.status }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}