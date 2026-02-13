import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function DELETE(request: NextRequest) {
  try {
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

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(`${baseUrl}/academics/teacher-subject-assignments/remove?${queryString}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to remove assignment' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Teacher Subject Assignments Remove API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
