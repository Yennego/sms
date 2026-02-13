import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ classId: string; attendance_date: string }> }
) {
  try {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('sa_accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;

    const tenantId =
      cookieStore.get('tenantId')?.value ||
      cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    }

    // Await dynamic params per Next.js dynamic APIs requirement
    const { classId, attendance_date } = await context.params;

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/attendance/class/${classId}/date/${attendance_date}`;
    const { signal, cancel } = createTimeoutSignal(30_000);
    const res = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(errorData, { status: res.status });
      } catch {
        return NextResponse.json(
          { message: 'Failed to fetch class attendance', details: errorText || res.statusText },
          { status: res.status }
        );
      }
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[Attendance Class/Date API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
