import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const cookies = request.headers.get('cookie') || '';
  const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
  const tokenMatch = cookies.match(/(?:^|; )accessToken=([^;]+)|tn_accessToken=([^;]+)/);

  const tenantId = tenantMatch ? tenantMatch[1] : null;
  const accessToken = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;

  if (!tenantId) return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
  if (!accessToken) return NextResponse.json({ error: 'Access token not found' }, { status: 401 });

  const backendUrl = `${process.env.BACKEND_API_URL}/academics/enrollments/${id}`;
  const response = await fetch(backendUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text().catch(() => '');
    return NextResponse.json({ error: error || 'Failed to fetch enrollment' }, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const cookies = request.headers.get('cookie') || '';
  const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
  const tokenMatch = cookies.match(/(?:^|; )accessToken=([^;]+)|tn_accessToken=([^;]+)/);

  const tenantId = tenantMatch ? tenantMatch[1] : null;
  const accessToken = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;

  if (!tenantId) return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
  if (!accessToken) return NextResponse.json({ error: 'Access token not found' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  const backendUrl = `${process.env.BACKEND_API_URL}/academics/enrollments/${id}`;
  const response = await fetch(backendUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const errorData = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => '');
    return NextResponse.json(errorData || { error: 'Failed to update enrollment' }, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const cookies = request.headers.get('cookie') || '';
  const tenantMatch = cookies.match(/tn_tenantId=([^;]+)/);
  const tokenMatch = cookies.match(/(?:^|; )accessToken=([^;]+)|tn_accessToken=([^;]+)/);

  const tenantId = tenantMatch ? tenantMatch[1] : null;
  const accessToken = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;

  if (!tenantId) return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
  if (!accessToken) return NextResponse.json({ error: 'Access token not found' }, { status: 401 });

  const backendUrl = `${process.env.BACKEND_API_URL}/academics/enrollments/${id}`;
  const response = await fetch(backendUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': tenantId,
    },
  });

  if (!response.ok) {
    const error = await response.text().catch(() => '');
    return NextResponse.json({ error: error || 'Failed to delete enrollment' }, { status: response.status });
  }

  return NextResponse.json({ success: true }, { status: 204 });
}