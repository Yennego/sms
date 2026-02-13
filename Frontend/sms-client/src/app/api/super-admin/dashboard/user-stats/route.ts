import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('tn_accessToken')?.value || cookieStore.get('sa_accessToken')?.value || cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    if (!backendUrl.endsWith('/api/v1')) {
      backendUrl = backendUrl.replace(/\/+$/, '') + '/api/v1';
    }

    // Call the actual backend API
    const response = await fetch(`${backendUrl}/super-admin/users`, {
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

    const users = await response.json();

    // Get tenants to calculate average users per tenant
    const tenantsResponse = await fetch(`${backendUrl}/super-admin/tenants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    let tenants: any[] = [];
    if (tenantsResponse.ok) {
      tenants = await tenantsResponse.json();
    }

    // Calculate user statistics
    const userStats = {
      total: users.length,
      active: users.filter((u: any) => u.isActive || u.is_active).length,
      inactive: users.filter((u: any) => !(u.isActive || u.is_active)).length,
      avgPerTenant: Math.round(users.length / (tenants.length || 1)),
      recentLogins: users.filter((u: any) => {
        if (!u.lastLogin && !u.last_login) return false;
        const lastLogin = new Date(u.lastLogin || u.last_login);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastLogin.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }).length
    };

    return NextResponse.json(userStats);
  } catch (error) {
    console.error('Error in user stats API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user statistics' },
      { status: 500 }
    );
  }
}