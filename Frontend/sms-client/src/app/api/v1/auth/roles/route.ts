import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getNamespacedCookie } from '@/lib/cookies';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const response = await fetch(`${process.env.BACKEND_API_URL}/auth/roles`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch roles' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Roles list API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const response = await fetch(`${process.env.BACKEND_API_URL}/auth/roles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create role' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Create role API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
