import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
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
    const fullUrl = `${backendUrl}/super-admin/dashboard/tenant-stats`;

    const superAdminTenantId =
      cookieStore.get('tn_tenantId')?.value ||
      cookieStore.get('sa_tenantId')?.value ||
      cookieStore.get('tenantId')?.value ||
      '6d78d2cc-27ba-4da7-a06f-6186aadb4766';

    console.log(`[Tenant-Stats Proxy] Calling: ${fullUrl}, TenantID: ${superAdminTenantId}`);

    const response = await axios({
      method: 'GET',
      url: fullUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': superAdminTenantId,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
      timeout: 30000
    });

    if (response.status !== 200) {
      console.error('[Tenant Stats API] Backend error:', response.status, response.data);
      return NextResponse.json({
        error: `Backend API error: ${response.status}`,
        details: response.data
      }, { status: response.status });
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('[Tenant Stats API] Internal error:', error.message);
    return NextResponse.json({
      error: 'Failed to fetch tenant stats',
      details: error.message
    }, { status: 500 });
  }
}