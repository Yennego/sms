import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // In a real implementation, you would fetch this data from your backend
    // For now, return mock data that matches the structure expected by the dashboard
    const userStats = {
      total: 120,
      active: 95,
      inactive: 25,
      avgPerTenant: 15,
      recentLogins: 42
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