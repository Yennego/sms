import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_ids } = body;

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return NextResponse.json(
        { message: 'student_ids array is required' },
        { status: 400 }
      );
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of student_ids) {
      if (!uuidRegex.test(id)) {
        return NextResponse.json(
          { message: `Invalid student ID format: ${id}` },
          { status: 400 }
        );
      }
    }

    const cookieStore = await cookies();
    const tenantIdCookieNamespaced = cookieStore.get('tn_tenantId')?.value;
    const tenantIdCookiePlain = cookieStore.get('tenantId')?.value;
    const tenantIdHeader = request.headers.get('x-tenant-id') || request.headers.get('X-Tenant-ID');
    const tenantId = tenantIdHeader || tenantIdCookieNamespaced || tenantIdCookiePlain;

    if (!tenantId || !uuidRegex.test(tenantId)) {
      return NextResponse.json(
        { message: 'Tenant ID missing or invalid' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookieAccessToken = cookieStore.get('tn_accessToken')?.value || cookieStore.get('accessToken')?.value;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader ?? cookieAccessToken;

    if (!accessToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Bulk Enrollments API] Fetching enrollments for ${student_ids.length} students`);

    // Fetch enrollments for all students
    const enrollments: Record<string, any> = {};
    const batchSize = 10;
    
    for (let i = 0; i < student_ids.length; i += batchSize) {
      const batch = student_ids.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (studentId: string) => {
          try {
            const origin = (process.env.BACKEND_API_URL ?? '').replace(/\/+$/, '');
            const base = /\/api\/v1\/?$/.test(origin) ? origin : `${origin}/api/v1`;
            const url = `${base}/people/students/${encodeURIComponent(studentId)}/enrollments/current`;

            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'X-Tenant-ID': tenantId,
              },
              cache: 'no-store',
            });

            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data) && data.length > 0) {
                enrollments[studentId] = data[0];
              } else if (data && data.id) {
                enrollments[studentId] = data;
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch enrollment for student ${studentId}:`, error);
          }
        })
      );
    }

    console.log(`[Bulk Enrollments API] Successfully fetched ${Object.keys(enrollments).length} enrollments`);
    return NextResponse.json({ enrollments });
  } catch (error) {
    console.error('Error in bulk enrollments endpoint:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
