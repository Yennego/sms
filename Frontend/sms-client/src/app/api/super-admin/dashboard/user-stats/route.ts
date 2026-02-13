import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('sa_accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value ||
      cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    if (!backendUrl.endsWith('/api/v1')) {
      backendUrl = backendUrl.replace(/\/+$/, '') + '/api/v1';
    }

    // Call the actual backend API
    const response = await axios.get(`${backendUrl}/super-admin/users`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const users = response.data;

    // Get tenants to calculate average users per tenant
    const tenantsResponse = await axios.get(`${backendUrl}/super-admin/tenants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const tenants = tenantsResponse.data || [];

    // Calculate user statistics robustly
    const userStats = {
      total: Array.isArray(users) ? users.length : 0,
      active: Array.isArray(users) ? users.filter((u: any) => u.isActive || u.is_active).length : 0,
      inactive: Array.isArray(users) ? users.filter((u: any) => !(u.isActive || u.is_active)).length : 0,
      avgPerTenant: Math.round((Array.isArray(users) ? users.length : 0) / (Array.isArray(tenants) && tenants.length > 0 ? tenants.length : 1)),
      recentLogins: Array.isArray(users) ? users.filter((u: any) => {
        if (!u.lastLogin && !u.last_login) return false;
        try {
          const lastLogin = new Date(u.lastLogin || u.last_login);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - lastLogin.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        } catch { return false; }
      }).length : 0
    };

    return NextResponse.json(userStats);
  } catch (error: any) {
    console.error('Error in user stats API:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch user statistics', message: error.message },
      { status: 500 }
    );
  }
}