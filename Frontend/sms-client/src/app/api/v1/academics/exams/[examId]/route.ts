import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const { examId } = params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/exams/${examId}`;
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json({ error: errorText || `Backend error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Exam API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const { examId } = params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const body = await request.json();

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/exams/${examId}`;
    const { signal, cancel } = createTimeoutSignal(45_000);
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    cancel();

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json({ error: errorText || `Backend error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Exam API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const { examId } = params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const backendUrl = `${baseUrl}/academics/exams/${examId}`;
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      signal,
    });
    cancel();

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json({ error: errorText || `Backend error: ${response.status}` }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Exam API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
