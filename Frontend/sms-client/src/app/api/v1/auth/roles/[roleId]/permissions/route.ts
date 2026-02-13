import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(_request: NextRequest, { params }: { params: { roleId: string } }) {
  try {
    const { roleId } = params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/auth/roles/${roleId}/permissions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch role permissions' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Get role permissions API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { roleId: string } }) {
  try {
    const body = await request.json(); // expected: { permission_names: string[] }
    const { roleId } = params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const baseUrl2 = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal: s2, cancel: c2 } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl2}/auth/roles/${roleId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: s2,
    });
    c2();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to assign permissions to role' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Assign role permissions API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { roleId: string } }) {
  try {
    const body = await request.json(); // expected: { permission_names: string[] }
    const { roleId } = params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const baseUrl3 = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal: s3, cancel: c3 } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl3}/auth/roles/${roleId}/permissions`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: s3,
    });
    c3();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to set role permissions' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Set role permissions API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
