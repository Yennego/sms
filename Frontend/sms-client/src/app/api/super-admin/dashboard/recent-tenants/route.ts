import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { normalizeBaseUrl } from '@/app/api/_lib/http';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '5';

    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('tn_accessToken')?.value ||
      cookieStore.get('sa_accessToken')?.value ||
      cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      console.warn('[Recent Tenants API] No access token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const fullUrl = `${backendUrl}/super-admin/dashboard/recent-tenants?limit=${limit}`;

    const superAdminTenantId =
      cookieStore.get('tn_tenantId')?.value ||
      cookieStore.get('sa_tenantId')?.value ||
      cookieStore.get('tenantId')?.value ||
      '6d78d2cc-27ba-4da7-a06f-6186aadb4766';

    console.log(`[Recent-Tenants Proxy] Calling: ${fullUrl}, TenantID: ${superAdminTenantId}`);

    const response = await axios({
      method: 'GET',
      url: fullUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': superAdminTenantId,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 30000
    });

    if (response.status !== 200) {
      console.error('[Recent Tenants API] Backend error:', response.status, response.data);
      return NextResponse.json({
        error: `Backend API error: ${response.status}`,
        details: response.data
      }, { status: response.status });
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('[Recent Tenants API] Internal error:', error.message);
    return NextResponse.json({
      error: 'Failed to fetch recent tenants',
      details: error.message
    }, { status: 500 });
  }
}