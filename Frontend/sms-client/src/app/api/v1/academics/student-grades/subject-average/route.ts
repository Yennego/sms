import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
  const tenantId = cookieStore.get('tn_tenantId')?.value || cookieStore.get('tenantId')?.value;
  if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

  const qs = request.nextUrl.searchParams.toString();
  const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
  const { signal, cancel } = createTimeoutSignal(90_000);
  const res = await fetch(`${baseUrl}/academics/grades/subject-average?${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
    signal,
  });
  cancel();
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

