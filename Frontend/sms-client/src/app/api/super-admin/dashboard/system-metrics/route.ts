import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('tn_accessToken')?.value || cookieStore.get('sa_accessToken')?.value || cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    if (!backendUrl.endsWith('/api/v1')) {
      backendUrl = backendUrl.replace(/\/+$/, '') + '/api/v1';
    }

    const response = await fetch(`${backendUrl}/super-admin/dashboard/system-metrics`, {
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

    const systemMetrics = await response.json();
    return NextResponse.json(systemMetrics);
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system metrics' },
      { status: 500 }
    );
  }
}