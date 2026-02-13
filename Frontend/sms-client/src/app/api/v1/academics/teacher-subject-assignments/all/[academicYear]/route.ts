import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academicYear: string }> }
) {
  try {
    const { academicYear } = await params;
    console.log('[Teacher Subject Assignments API] Processing GET all assignments request for academic year:', academicYear);
    
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 400 }
      );
    }

    console.log(`[Teacher Subject Assignments API] Fetching classes for academic year ${academicYear} with X-Tenant-ID: ${tenantId}`);

    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const { signal, cancel } = createTimeoutSignal(30_000);
    const response = await fetch(`${baseUrl}/academics/classes?academic_year=${encodeURIComponent(academicYear)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        signal,
      }
    );
    cancel();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to fetch classes' 
      }));
      console.error('[Teacher Subject Assignments API] Backend error:', response.status, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const classes = await response.json();
    const assignments = Array.isArray(classes) ? classes.map((cls: any) => ({
      grade_id: cls.grade_id,
      section_id: cls.section_id,
      subject_id: cls.subject_id,
      grade_name: '',
      section_name: '',
      subject_name: '',
      class_name: cls.name ?? `${cls.grade_id}-${cls.section_id}-${cls.subject_id}`,
      teacher_id: cls.teacher_id || undefined,
      teacher_name: undefined,
      is_assigned: !!cls.teacher_id,
    })) : [];

    console.log('[Teacher Subject Assignments API] Successfully built assignments');
    return NextResponse.json(assignments);

  } catch (error) {
    console.error('[Teacher Subject Assignments API] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
