import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

function dayOfWeekFromIsoDate(isoDate: string) {
  const d = new Date(isoDate);
  return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][d.getUTCDay()];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      class_id,
      academic_year_id,
      date,
      schedule_id,
      period,
      attendances,
    } = body || {};

    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value || '';
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value || '';

    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    if (!class_id || !academic_year_id || !date || !Array.isArray(attendances)) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const dow = dayOfWeekFromIsoDate(date);
    const baseUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);

    const qsVerify = new URLSearchParams({ class_id, day_of_week: dow });
    const periodNum =
      typeof period === 'number'
        ? period
        : parseInt(String(period ?? '').match(/\d+/)?.[0] ?? '', 10);
    if (!Number.isNaN(periodNum)) qsVerify.append('period', String(periodNum));

    // Fetch schedules and verify provided schedule_id; fallback by period or first
    const { signal: vSignal, cancel: vCancel } = createTimeoutSignal(90_000);
    const verifyRes = await fetch(`${baseUrl}/academics/schedules?${qsVerify.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      signal: vSignal,
    });
    vCancel();

    if (!verifyRes.ok) {
      const err = await verifyRes.text().catch(() => '');
      return NextResponse.json({ message: 'Failed to resolve schedule', error: err }, { status: verifyRes.status });
    }

    const schedules = await verifyRes.json();
    if (!Array.isArray(schedules) || !schedules.length) {
      return NextResponse.json({ message: 'No valid schedule found', resolved_schedule_id: null }, { status: 422 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedScheduleId = schedule_id;
    const exists = uuidRegex.test(String(resolvedScheduleId || '')) && schedules.some((s: any) => String(s?.id) === String(resolvedScheduleId));
    if (!exists) {
      const exact = !Number.isNaN(periodNum)
        ? schedules.find((s: any) => Number(s?.period) === Number(periodNum))
        : undefined;
      resolvedScheduleId = String(exact?.id ?? schedules[0].id);
    }

    // Fan-out: per-student mark-daily using verified/fallback schedule_id
    const results: Array<{ student_id: string; ok: boolean; status?: number; error?: string; attendance?: any }> = [];
    for (const item of attendances) {
      const { student_id, status } = item || {};
      if (!student_id || !status) {
        results.push({ student_id: student_id || 'unknown', ok: false, error: 'Missing student_id or status' });
        continue;
      }
      const url = `${baseUrl}/academics/attendance/mark-daily`
        + `?student_id=${encodeURIComponent(student_id)}`
        + `&class_id=${encodeURIComponent(class_id)}`
        + `&schedule_id=${encodeURIComponent(resolvedScheduleId)}`
        + `&academic_year_id=${encodeURIComponent(academic_year_id)}`
        + `&status=${encodeURIComponent(status)}`
        + `&attendance_date=${encodeURIComponent(date)}`;

      const { signal: mSignal, cancel: mCancel } = createTimeoutSignal(90_000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        signal: mSignal,
      });
      mCancel();

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        results.push({ student_id, ok: false, status: res.status, error: errTxt || res.statusText });
      } else {
        const data = await res.json();
        results.push({ student_id, ok: true, status: res.status, attendance: data });
      }
    }

    const failures = results.filter(r => !r.ok);
    const successes = results.filter(r => r.ok);
    if (failures.length && successes.length) {
      return NextResponse.json({ results, resolved_schedule_id: resolvedScheduleId }, { status: 207 });
    }
    if (failures.length && !successes.length) {
      return NextResponse.json({ results, resolved_schedule_id: resolvedScheduleId }, { status: 422 });
    }
    return NextResponse.json({ results, resolved_schedule_id: resolvedScheduleId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Internal error', error: String(error?.message || error) }, { status: 500 });
  }
}

