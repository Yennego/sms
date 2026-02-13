import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const headers = {
      'Content-Type': 'application/json',
      // Add any other headers your backend API requires
    };
    // In a real implementation, you would fetch this data from your backend
    // For now, we'll return mock data that matches the structure expected by the dashboard
    const dashboardData = {
      students: { total: 250, change: 5 },
      teachers: { total: 32, change: 2 },
      classes: { total: 48, change: -1 },
      attendanceData: [
        { name: 'Mon', attendance: 85 },
        { name: 'Tue', attendance: 90 },
        { name: 'Wed', attendance: 88 },
        { name: 'Thu', attendance: 92 },
        { name: 'Fri', attendance: 87 },
      ],
      gradeDistribution: [
        { name: 'A', value: 30 },
        { name: 'B', value: 40 },
        { name: 'C', value: 20 },
        { name: 'D', value: 7 },
        { name: 'F', value: 3 },
      ],
      recentActivities: [
        { title: 'New student enrolled', timestamp: '2023-06-15 09:30 AM' },
        { title: 'Exam results published', timestamp: '2023-06-14 03:15 PM' },
        { title: 'Teacher meeting scheduled', timestamp: '2023-06-13 11:45 AM' },
        { title: 'System maintenance completed', timestamp: '2023-06-12 08:00 PM' },
      ]
    };

    return NextResponse.json(dashboardData, { 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-access-token',
      } 
    });
  } catch (error) {
    console.error('Error in dashboard metrics API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500, headers: {
        'Content-Type': 'application/json',
      } }
    );
  }
}