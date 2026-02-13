import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getNamespacedCookie } from '@/lib/cookies';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
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
      `${process.env.BACKEND_API_URL}/people/teachers/bulk`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create bulk teachers' }));
      return NextResponse.json(errorData, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating bulk teachers:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
