import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const params = request.nextUrl.searchParams;
    const base = normalizeBaseUrl(process.env.BACKEND_API_URL);

    const gradeId = params.get('grade_id');
    const yearId = params.get('academic_year_id');

    if (!gradeId && yearId) {
      const { signal, cancel } = createTimeoutSignal(90_000);
      const gradesResp = await fetch(`${base}/academics/academic-grades?is_active=true&skip=0&limit=100`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
        signal,
      });
      cancel();
      const gradesData = await gradesResp.json().catch(() => []);
      const grades = Array.isArray(gradesData) ? gradesData.slice(0, 20) : [];

      const chunk = (arr: any[], size: number) => arr.reduce((acc: any[][], _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
      const batches = chunk(grades, 6);
      const results: any[] = [];

      for (const batch of batches) {
        const ops = batch.map(async (g: any) => {
          const { signal: s2, cancel: c2 } = createTimeoutSignal(90_000);
          const r = await fetch(`${base}/academics/promotions/criteria?academic_year_id=${encodeURIComponent(yearId)}&grade_id=${encodeURIComponent(g.id)}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
            signal: s2,
          });
          c2();
          if (r.ok) {
            const arr = await r.json().catch(() => []);
            if (Array.isArray(arr) && arr.length) results.push(...arr);
          }
        });
        await Promise.allSettled(ops);
      }

      return NextResponse.json(results);
    }

    const qs = params.toString();
    const { signal, cancel } = createTimeoutSignal(90_000);
    const resp = await fetch(`${base}/academics/promotions/criteria${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      signal,
    });
    cancel();

    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      if (resp.status === 404 || !ct.includes('application/json')) return NextResponse.json([], { status: 200 });
      const err = await resp.json().catch(() => ({ message: 'Failed to fetch promotion criteria' }));
      return NextResponse.json(err, { status: resp.status });
    }

    const data = ct.includes('application/json') ? await resp.json() : [];
    return NextResponse.json(data);
  } catch (e: any) {
    if (e?.name === 'AbortError') return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('tn_accessToken')?.value;
    const tenantId = cookieStore.get('tenantId')?.value || cookieStore.get('tn_tenantId')?.value;
    if (!accessToken) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    if (!tenantId) return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });

    const body = await request.json();
    const base = normalizeBaseUrl(process.env.BACKEND_API_URL);
    const gradeId = Array.isArray(body) ? undefined : body?.grade_id;
    const yearId = Array.isArray(body) ? undefined : body?.academic_year_id;

    if (Array.isArray(body)) {
      let created = 0;
      let updated = 0;
      const errors: any[] = [];

      const chunk = (arr: any[], size: number) => arr.reduce((acc: any[][], _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
      const batches = chunk(body, 6);

      for (const batch of batches) {
        const ops = batch.map(async (item) => {
          const yr = item?.academic_year_id;
          const gr = item?.grade_id;
          if (!yr || !gr) { errors.push({ grade_id: gr || null, status: 400 }); return; }

          const { signal: s1, cancel: c1 } = createTimeoutSignal(90_000);
          const existingResp = await fetch(`${base}/academics/promotions/criteria?academic_year_id=${encodeURIComponent(yr)}&grade_id=${encodeURIComponent(gr)}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
            signal: s1,
          });
          c1();
          const existing = existingResp.ok ? await existingResp.json().catch(() => []) : [];
          const target = Array.isArray(existing) && existing.length ? existing[0] : null;

          if (target?.id) {
            const { signal: s2, cancel: c2 } = createTimeoutSignal(90_000);
            const putResp = await fetch(`${base}/academics/promotions/criteria/${target.id}`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
              signal: s2,
            });
            c2();
            if (putResp.ok) updated++; else errors.push({ grade_id: gr, status: putResp.status });
          } else {
            const { signal: s3, cancel: c3 } = createTimeoutSignal(90_000);
            const postResp = await fetch(`${base}/academics/promotions/criteria`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
              signal: s3,
            });
            c3();
            if (postResp.ok) created++; else errors.push({ grade_id: gr, status: postResp.status });
          }
        });
        await Promise.allSettled(ops);
      }
      return NextResponse.json({ created, updated, errors });
    }

    if (!gradeId && yearId) {
      const { signal: s0, cancel: c0 } = createTimeoutSignal(90_000);
      const gradesResp = await fetch(`${base}/academics/academic-grades?is_active=true&skip=0&limit=100`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
        signal: s0,
      });
      c0();
      const gradesData = await gradesResp.json().catch(() => []);
      const grades = Array.isArray(gradesData) ? gradesData : [];
      let created = 0;
      let updated = 0;
      const errors: any[] = [];
      const chunk = (arr: any[], size: number) => arr.reduce((acc: any[][], _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
      const batches = chunk(grades, 6);
      for (const group of batches) {
        const ops = group.map(async (g) => {
          const payload = { ...body, grade_id: g.id };
          const { signal: s1, cancel: c1 } = createTimeoutSignal(90_000);
          const existingResp = await fetch(`${base}/academics/promotions/criteria?academic_year_id=${encodeURIComponent(yearId)}&grade_id=${encodeURIComponent(g.id)}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
            signal: s1,
          });
          c1();
          const existing = existingResp.ok ? await existingResp.json().catch(() => []) : [];
          const target = Array.isArray(existing) && existing.length ? existing[0] : null;
          if (target?.id) {
            const { signal: s2, cancel: c2 } = createTimeoutSignal(90_000);
            const putResp = await fetch(`${base}/academics/promotions/criteria/${target.id}`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: s2,
            });
            c2();
            if (putResp.ok) updated++; else errors.push({ grade_id: g.id, status: putResp.status });
          } else {
            const { signal: s3, cancel: c3 } = createTimeoutSignal(90_000);
            const postResp = await fetch(`${base}/academics/promotions/criteria`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: s3,
            });
            c3();
            if (postResp.ok) created++; else errors.push({ grade_id: g.id, status: postResp.status });
          }
        });
        await Promise.allSettled(ops);
      }
      return NextResponse.json({ created, updated, errors });
    }

    const { signal, cancel } = createTimeoutSignal(90_000);
    const resp = await fetch(`${base}/academics/promotions/criteria`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-ID': tenantId, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    cancel();

    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      let payload: any = {};
      if (ct.includes('application/json')) {
        payload = await resp.json().catch(() => ({}));
      } else {
        const text = await resp.text().catch(() => '');
        payload = text ? { message: text } : {};
      }
      const message = payload?.detail || payload?.message || 'Failed to create promotion criteria';
      return NextResponse.json({ message }, { status: resp.status });
    }

    const data = ct.includes('application/json') ? await resp.json() : {};
    return NextResponse.json(data);
  } catch (e: any) {
    if (e?.name === 'AbortError') return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}


