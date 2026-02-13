import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';
import { getNamespacedCookie } from '@/lib/cookies';

// method: GET
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Fix: Await params to resolve Next.js 15 async params issue
    const { id } = await params;
    const cookieStore = await cookies();
    // Fix: Use correct cookie names that match auth context
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

    console.log(`[Class Students API] Fetching students for class ${id} with tenant: ${tenantId}`);

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/academics/classes/${id}/students`, {
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
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch students' }));
      console.error(`[Class Students API] Backend error:`, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log(`[Class Students API] Successfully fetched ${data.length || 0} students`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in class students API route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
