import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('tn_accessToken')?.value;
    const tenantId =
      cookieStore.get('tenantId')?.value ||
      cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Tenant context required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let baseUrl = process.env.BACKEND_API_URL || '';
    if (!baseUrl.endsWith('/api/v1')) {
      baseUrl = baseUrl.replace(/\/+$/, '') + '/api/v1';
    }

    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();

    const backendUrl = `${baseUrl}/academics/classes/${id}/enrollments/export${
      queryString ? '?' + queryString : ''
    }`;

    const resp = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
    });

    const contentType =
      resp.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition =
      resp.headers.get('content-disposition') ||
      `attachment; filename="class_${id}_enrollments.${
        searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'
      }"`;

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      const body = errBody || resp.statusText;
      return new Response(body, {
        status: resp.status,
        headers: { 'Content-Type': contentType },
      });
    }

    const arrayBuffer = await resp.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Export Enrollments API] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to export enrollments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}