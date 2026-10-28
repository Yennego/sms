// Shared plumbing for the public (no session) auth routes: forgot / reset password.
// No cookies or tokens are forwarded; only the school and the JSON body.
import { NextRequest, NextResponse } from 'next/server';
import { normalizeBaseUrl } from '@/app/api/_lib/http';

// A school id (UUID), code or domain, as it appears in the page URL
const SCHOOL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export function schoolHeader(request: NextRequest): string | null {
  const value = (request.headers.get('x-tenant-id') || '').trim();
  return SCHOOL_PATTERN.test(value) ? value : null;
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Turn FastAPI's error detail (string or validation list) into one readable message. */
function messageFrom(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return 'Please check what you entered and try again.';
  return fallback;
}

export async function forwardPublicAuthPost(
  path: string,
  body: Record<string, string>,
  tenant: string,
): Promise<NextResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant };
  try {
    const upstream = await fetch(`${normalizeBaseUrl(process.env.BACKEND_API_URL)}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const res = NextResponse.json(
        { detail: messageFrom(data, 'Something went wrong. Please try again.') },
        { status: upstream.status },
      );
      const retryAfter = upstream.headers.get('retry-after');
      if (retryAfter) res.headers.set('Retry-After', retryAfter);
      return res;
    }
    return NextResponse.json({ message: (data as { message?: string } | null)?.message ?? 'Done.' });
  } catch (error) {
    console.error(`[api/${path}]`, error instanceof Error ? error.message : error);
    return NextResponse.json({ detail: 'The server could not be reached. Try again.' }, { status: 502 });
  }
}
