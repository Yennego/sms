import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizeBaseUrl } from '@/app/api/_lib/http';

export async function GET() {
  try {
    const cookieStore = await cookies();
    // Namespaced token check
    const accessToken =
      cookieStore.get('tn_accessToken')?.value ||
      cookieStore.get('sa_accessToken')?.value ||
      cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      console.warn('[Tenant Stats API] No access token found in cookies');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);

    const superAdminTenantId =
      cookieStore.get('tn_tenantId')?.value ||
      cookieStore.get('tenantId')?.value ||
      '6d78d2cc-27ba-4da7-a06f-6186aadb4766';

    console.log(`[Tenant-Stats Proxy] TenantID: ${superAdminTenantId}`);

    const response = await fetch(`${backendUrl}/super-admin/dashboard/tenant-stats`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': superAdminTenantId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Tenant Stats API] Backend error:', response.status, errorText);
      return NextResponse.json({ error: `Backend API error: ${response.status}` }, { status: response.status });
    }

    const tenantStats = await response.json();
    return NextResponse.json(tenantStats);
  } catch (error) {
    console.error('[Tenant Stats API] Internal error:', error);
    return NextResponse.json({ error: 'Failed to fetch tenant stats' }, { status: 500 });
  }
}