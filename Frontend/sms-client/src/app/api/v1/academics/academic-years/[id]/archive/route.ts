import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

async function getAuth() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
  const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
  return { accessToken, tenantId };
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { accessToken, tenantId } = await getAuth();
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl}/academics/academic-years/${params.id}/archive`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      signal,
    });
    cancel();

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Failed to archive academic year' }));
      return NextResponse.json(err, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('[Archive Year API] Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
