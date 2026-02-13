import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getNamespacedCookie } from '@/lib/cookies';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;
    const tenantId = await getNamespacedCookie(cookieStore, 'tenantId');

    if (!accessToken) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const skip = url.searchParams.get('skip') ?? '0';
    const limit = url.searchParams.get('limit') ?? '100';
    const search = url.searchParams.get('search') ?? undefined;

    const params = new URLSearchParams();
    params.set('skip', skip);
    params.set('limit', limit);
    if (search) params.set('search', search);

    const response = await fetch(
      `${process.env.BACKEND_API_URL}/auth/users/active?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch active users' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Active users API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
