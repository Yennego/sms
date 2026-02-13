import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('tn_accessToken')?.value || cookieStore.get('sa_accessToken')?.value || cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    let backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    if (!backendUrl.endsWith('/api/v1')) {
      backendUrl = backendUrl.replace(/\/+$/, '') + '/api/v1';
    }

    // Call the actual backend API
    const response = await fetch(`${backendUrl}/super-admin/tenants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const tenants = await response.json();

    // Sort by creation date (newest first) and take the requested number
    const sortedTenants = [...tenants]
      .sort((a, b) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime())
      .slice(0, limit);

    return NextResponse.json(sortedTenants);
  } catch (error) {
    console.error('Error in recent tenants API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent tenants' },
      { status: 500 }
    );
  }
}