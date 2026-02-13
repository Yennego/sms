import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('--- Entering /api/auth/logout Next.js API route ---');
    
    // Get authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      // Even without token, return success for logout
      return NextResponse.json(
        { message: 'Successfully logged out' },
        { status: 200 }
      );
    }

    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-ID') || '00000000-0000-0000-0000-000000000001';
    
    // Ensure BACKEND_API_URL is available
    const backendUrl = process.env.BACKEND_API_URL;
    if (!backendUrl) {
      console.error('BACKEND_API_URL environment variable is not set');
      // Still return success for logout even if backend is unavailable
      return NextResponse.json(
        { message: 'Successfully logged out' },
        { status: 200 }
      );
    }

    const fullUrl = `${backendUrl}/auth/logout`;
    console.log('Calling backend logout URL:', fullUrl);

    try {
      // Call backend API
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log('Backend logout response status:', response.status);
      console.log('Backend logout response:', responseText);

      // Parse response if possible
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('Could not parse logout response as JSON:', parseError);
        data = { message: 'Successfully logged out' };
      }

      // Always return success for logout, regardless of backend response
      return NextResponse.json(
        { message: 'Successfully logged out' },
        { status: 200 }
      );
      
    } catch (backendError) {
      console.error('Backend logout error:', backendError);
      // Still return success - logout should always succeed on frontend
      return NextResponse.json(
        { message: 'Successfully logged out' },
        { status: 200 }
      );
    }
    
  } catch (error) {
    console.error('Unhandled error in logout route:', error);
    // Even on error, return success for logout
    return NextResponse.json(
      { message: 'Successfully logged out' },
      { status: 200 }
    );
  } finally {
    console.log('--- Exiting /api/auth/logout Next.js API route ---');
  }
}