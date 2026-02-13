import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const reason = searchParams.get('reason');

  if (!status) {
    return NextResponse.json({ message: 'Status is required' }, { status: 400 });
  }

  const queryParams = new URLSearchParams();
  queryParams.append('status', status);
  if (reason) queryParams.append('reason', reason);

  const cookieStore = await cookies();

  const accessToken =
    cookieStore.get('accessToken')?.value ||
    cookieStore.get('tn_accessToken')?.value ||
    request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null;

  const tenantId =
    cookieStore.get('tenantId')?.value ||
    cookieStore.get('tn_tenantId')?.value ||
    request.headers.get('X-Tenant-ID') || null;

  const headers: HeadersInit = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(
    `${process.env.BACKEND_API_URL}/people/students/${id}/status?${queryParams.toString()}`,
    { method: 'PUT', headers }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update student status' }));
    return NextResponse.json(error, { status: response.status });
  }

  const data = await response.json().catch(() => null);
  return NextResponse.json(data);
}