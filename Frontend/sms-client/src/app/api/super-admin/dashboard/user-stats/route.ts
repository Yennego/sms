import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Call the actual backend API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/users`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }
    
    const users = await response.json();
    
    // Get tenants to calculate average users per tenant
    const tenantsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/tenants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!tenantsResponse.ok) {
      throw new Error(`Backend API error: ${tenantsResponse.status}`);
    }
    
    const tenants = await tenantsResponse.json();
    
    // Calculate user statistics
    const userStats = {
      total: users.length,
      active: users.filter((u: any) => u.isActive).length,
      inactive: users.filter((u: any) => !u.isActive).length,
      avgPerTenant: Math.round(users.length / (tenants.length || 1)),
      recentLogins: users.filter((u: any) => {
        // Count logins in the last 7 days
        if (!u.lastLogin) return false;
        const lastLogin = new Date(u.lastLogin);
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