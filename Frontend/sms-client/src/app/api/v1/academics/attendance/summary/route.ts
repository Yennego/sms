import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

// Helper function to get namespaced cookie
function getNamespacedCookie(cookieStore: ReadonlyRequestCookies, key: string, namespace: string = ''): string | undefined {
  const namespacedKey = `${namespace}${key}`;
  return cookieStore.get(namespacedKey)?.value;
}

export async function GET(request: NextRequest) {
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
    
    // Forward query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    console.log(`[Attendance Summary API] Sending request to backend with X-Tenant-ID: ${tenantId}`);
    
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/attendance/summary${queryString ? '?' + queryString : ''}`;
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(backendUrl, {
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
      console.error(`[Attendance Summary API] Backend error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[Attendance Summary API] Backend error details: ${errorText}`);
      
      return NextResponse.json(
        { message: 'Failed to fetch attendance summary from backend' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[Attendance Summary API] Successfully fetched attendance summary`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance summary' },
      { status: 500 }
    );
  }
}

