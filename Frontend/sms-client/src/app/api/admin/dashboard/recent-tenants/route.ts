import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // In a real implementation, you would fetch this data from your backend
    // For now, return mock data that matches the structure expected by the dashboard
    const recentTenants = [
      {
        id: '1',
        name: 'ABC School',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        userCount: 25
      },
      {
        id: '2',
        name: 'XYZ Academy',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        userCount: 18
      },
      {
        id: '3',
        name: 'City High School',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: false,
        userCount: 12
      }
    ];
    
    return NextResponse.json(recentTenants);
  } catch (error) {
    console.error('Error in recent tenants API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent tenants' },
      { status: 500 }
    );
  }
}