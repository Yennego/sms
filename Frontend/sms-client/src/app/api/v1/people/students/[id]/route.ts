import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();

    // Prefer cookies (default and tenant namespace), fallback to request headers
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value ||
      request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null;

    const tenantId =
      cookieStore.get('tenantId')?.value ||
      cookieStore.get('tn_tenantId')?.value ||
      request.headers.get('X-Tenant-ID') || null;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const response = await fetch(`${process.env.BACKEND_API_URL}/people/students/${id}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch student' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json().catch(() => null);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ message: 'Failed to fetch student' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value ||
      request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null;

    const tenantId =
      cookieStore.get('tenantId')?.value ||
      cookieStore.get('tn_tenantId')?.value ||
      request.headers.get('X-Tenant-ID') || null;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const response = await fetch(`${process.env.BACKEND_API_URL}/people/students/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update student' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json().catch(() => null);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ message: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
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

    const response = await fetch(`${process.env.BACKEND_API_URL}/people/students/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete student' }));
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ message: 'Failed to delete student' }, { status: 500 });
  }
}