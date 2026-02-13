import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function PUT(request: NextRequest, { params }: { params: { permissionId: string } }) {
  try {
    const body = await request.json();
    const { permissionId } = params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(45_000);
    const response = await fetch(`${baseUrl}/auth/permissions/${permissionId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    cancel();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update permission' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Update permission API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { permissionId: string } }) {
  try {
    const { permissionId } = params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

    const baseUrl2 = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal: s2, cancel: c2 } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl2}/auth/permissions/${permissionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: s2,
    });
    c2();

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete permission' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Delete permission API error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
