import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest, context: { params: any }) {
    const { id } = await context.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        return NextResponse.json({ message: 'Invalid student id format' }, { status: 400 });
    }

    const hdrs = req.headers;
    const cookieStore = await cookies();
    const tenantIdCookieNamespaced = cookieStore.get('tn_tenantId')?.value;
    const tenantIdCookiePlain = cookieStore.get('tenantId')?.value;
    const tenantIdHeader = hdrs.get('x-tenant-id') || hdrs.get('X-Tenant-ID') || undefined;
    const tenantId = tenantIdHeader || tenantIdCookieNamespaced || tenantIdCookiePlain;

    if (!tenantId || !uuidRegex.test(tenantId)) {
        return NextResponse.json({ message: 'Tenant id missing or invalid' }, { status: 400 });
    }

    const authHeader = hdrs.get('authorization') || hdrs.get('Authorization') || undefined;
    const cookieAccessToken = cookieStore.get('tn_accessToken')?.value || cookieStore.get('accessToken')?.value;
    const accessToken =
        authHeader?.startsWith('Bearer ') ? authHeader.slice(7) :
        authHeader ?? cookieAccessToken;

    if (!accessToken) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Normalize base and call the correct backend endpoint (people router)
    const origin = (process.env.BACKEND_API_URL ?? '').replace(/\/+$/, '');
    const base = /\/api\/v1\/?$/.test(origin) ? origin : `${origin}/api/v1`;
    const url = `${base}/people/students/${encodeURIComponent(id)}/enrollments/current`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Tenant-ID': tenantId,
        },
        cache: 'no-store',
    });

    // Handle the case where student has no active enrollment
    if (res.status === 404) {
        // Return a clear JSON response indicating no active enrollment
        return NextResponse.json(
            { 
                message: 'No active enrollment found for this student',
                enrollment: null,
                student_id: id
            }, 
            { status: 200 }
        );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}