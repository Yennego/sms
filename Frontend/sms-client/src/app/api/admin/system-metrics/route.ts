import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // In a real implementation, you would fetch this data from your backend
    // For now, we'll return mock data
    const systemMetrics = {
      cpuUsage: 35,
      memoryUsage: 42,
      diskUsage: 28,
      activeConnections: 18,
      alerts: [
        { message: 'High CPU usage detected', level: 'warning' },
        { message: 'New tenant registration requires approval', level: 'info' },
        { message: 'Database backup completed successfully', level: 'info' }
      ],
      tenantGrowth: [
        { month: 'Jan', tenants: 5 },
        { month: 'Feb', tenants: 8 },
        { month: 'Mar', tenants: 12 },
        { month: 'Apr', tenants: 15 },
        { month: 'May', tenants: 18 },
        { month: 'Jun', tenants: 22 }
      ]
    };

    return NextResponse.json(systemMetrics);
  } catch (error) {
    console.error('Error in system metrics API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system metrics' },
      { status: 500 }
    );
  }
}