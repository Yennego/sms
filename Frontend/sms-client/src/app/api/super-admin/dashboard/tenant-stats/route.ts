import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Await the cookies() call for Next.js 15 compatibility
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    const superAdminTenantId = cookieStore.get('superAdminTenantId')?.value || '6d78d2cc-27ba-4da7-a06f-6186aadb4766';

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use BACKEND_API_URL for server-side calls
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1';
    const response = await fetch(`${backendUrl}/super-admin/dashboard/tenant-stats`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': superAdminTenantId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const tenantStats = await response.json();
    return NextResponse.json(tenantStats);
  } catch (error) {
    console.error('Error fetching tenant stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant stats' },
      { status: 500 }
    );
  }
}