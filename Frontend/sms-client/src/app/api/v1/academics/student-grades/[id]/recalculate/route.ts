import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
  const tenantId = cookieStore.get('tn_tenantId')?.value || cookieStore.get('tenantId')?.value;
  if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

  const body = await request.json();
  const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
  const { signal, cancel } = createTimeoutSignal(45_000);
  const res = await fetch(`${baseUrl}/academics/grades/${params.id}/recalculate`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  cancel();
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
