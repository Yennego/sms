import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

// Helper function to get namespaced cookie
function getNamespacedCookie(cookieStore: ReadonlyRequestCookies, key: string, namespace: string = ''): string | undefined {
  const namespacedKey = `${namespace}${key}`;
  return cookieStore.get(namespacedKey)?.value;
}

export async function GET() {
  try {
    // Await the cookies() call for Next.js 15 compatibility
    const cookieStore = await cookies();
    
    // Try to get access token from different contexts
    const accessToken = getNamespacedCookie(cookieStore, 'accessToken', '') || // DEFAULT context
                       getNamespacedCookie(cookieStore, 'accessToken', 'sa_') || // SUPER_ADMIN context
                       getNamespacedCookie(cookieStore, 'accessToken', 'tn_'); // TENANT context
    
    // Check for tenantId in both DEFAULT and TENANT contexts
    const tenantId = getNamespacedCookie(cookieStore, 'tenantId', '') || // DEFAULT context
                    getNamespacedCookie(cookieStore, 'tenantId', 'tn_'); // TENANT context

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
    }

    // Use BACKEND_API_URL for server-side calls
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1';
    const response = await fetch(`${backendUrl}/tenants/dashboard/stats`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', response.status, errorText);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const dashboardStats = await response.json();
    return NextResponse.json(dashboardStats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}