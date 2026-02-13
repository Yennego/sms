import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    // Check both namespaced and plain cookie names
    const accessToken = cookieStore.get('tn_accessToken')?.value || cookieStore.get('sa_accessToken')?.value || cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use BACKEND_API_URL for server-side calls
    let backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    if (!backendUrl.endsWith('/api/v1')) {
      backendUrl = backendUrl.replace(/\/+$/, '') + '/api/v1';
    }

    const response = await fetch(`${backendUrl}/super-admin/dashboard/tenant-stats`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
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