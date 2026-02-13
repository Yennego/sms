import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  try {
    const { teacherId } = await params;
    console.log('[Teacher Subject Assignments API] Processing GET request for teacher:', teacherId);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();

    console.log(`[Teacher Subject Assignments API] Fetching assignments by teacher from backend with X-Tenant-ID: ${tenantId}`);
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(
      `${baseUrl}/academics/teacher-subject-assignments/teacher/${teacherId}${queryString ? '?' + queryString : ''}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        signal,
      }
    );
    cancel();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch teacher assignments' }));
      console.error('[Teacher Subject Assignments API] Backend error:', response.status, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log('[Teacher Subject Assignments API] Successfully fetched teacher assignments');
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Teacher Subject Assignments API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
