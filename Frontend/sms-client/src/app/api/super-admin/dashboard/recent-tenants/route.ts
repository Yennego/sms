import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { normalizeBaseUrl } from '@/app/api/_lib/http';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '5';

    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('sa_accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value ||
      cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);

    const tenantId =
      cookieStore.get('tn_tenantId')?.value ||
      cookieStore.get('tenantId')?.value ||
      '6d78d2cc-27ba-4da7-a06f-6186aadb4766';

    console.log(`[Recent-Tenants Proxy] TenantID: ${tenantId}`);

    const response = await axios.get(`${backendUrl}/super-admin/tenants?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json'
      }
    });

    const tenants = response.data;

    // Basic mapping for frontend if needed
    const recentTenants = Array.isArray(tenants) ? tenants.map((t: any) => ({
      ...t,
      createdAt: t.createdAt || t.created_at,
      updatedAt: t.updatedAt || t.updated_at,
      userCount: t.userCount || t.user_count || 0
    })) : [];

    return NextResponse.json(recentTenants);
  } catch (error: any) {
    console.error('Error in recent tenants API:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch recent tenants', message: error.message },
      { status: 500 }
    );
  }
}