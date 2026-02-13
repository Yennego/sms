import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Debug environment variable
    console.log('BACKEND_API_URL:', process.env.BACKEND_API_URL);
    
    // Get authorization header (refresh token)
    const authorization = request.headers.get('Authorization');
    const tenantId = request.headers.get('X-Tenant-ID') || '00000000-0000-0000-0000-000000000001';
    
    console.log('Refresh token authorization header:', authorization?.substring(0, 50) + '...');
    console.log('Tenant ID:', tenantId);
    
    if (!authorization) {
      return NextResponse.json(
        { message: 'Authorization header with refresh token required' },
        { status: 401 }
      );
    }
    
    // Ensure BACKEND_API_URL is available
    const backendUrl = process.env.BACKEND_API_URL;
    if (!backendUrl) {
      console.error('BACKEND_API_URL environment variable is not set');
      return NextResponse.json(
        { message: 'Backend configuration error' },
        { status: 500 }
      );
    }

    // FIX: Add /api/v1 prefix
    const fullUrl = `${backendUrl}/auth/refresh`;
    console.log('Calling refresh URL:', fullUrl);
    
    // Call backend API with token in Authorization header
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
    });
    
    // Get the response as text first
    const responseText = await response.text();
    
    // Log the raw response for debugging
    console.log('Refresh raw response status:', response.status);
    console.log('Refresh raw response text:', responseText);
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse refresh response as JSON:', parseError);
      console.error('Raw response was:', responseText);
      return NextResponse.json(
        { message: 'Invalid response from backend (not valid JSON)' },
        { status: 500 }
      );
    }
    
    // Return the response with the same status code from backend
    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}