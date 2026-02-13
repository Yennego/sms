import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    
    // Call the actual backend API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/tenants`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }
    
    const tenants = await response.json();
    
    // Sort by creation date (newest first) and take the requested number
    const sortedTenants = [...tenants]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map(tenant => ({
        ...tenant,
        userCount: Math.floor(Math.random() * 50) + 10 // This would come from a real API in production
      }));
    
    return NextResponse.json(sortedTenants);
  } catch (error) {
    console.error('Error in recent tenants API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent tenants' },
      { status: 500 }
    );
  }
}