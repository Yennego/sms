import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { current_password, new_password } = body;
    
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
    const response = await fetch(`${process.env.BACKEND_API_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({ current_password, new_password }),
    });
    
    // Get the response as text first
    const responseText = await response.text();
    
    // Log the raw response for debugging
    console.log('Change password raw response status:', response.status);
    console.log('Change password raw response text:', responseText);
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse change password response as JSON:', parseError);
      return NextResponse.json(
        { message: 'Invalid response from backend' },
        { status: 500 }
      );
    }
    
    // Return the response with the same status code from backend
    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}