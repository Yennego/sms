// Public: asks the backend to email a password reset link. The school comes from the page URL
// (sent as X-Tenant-ID); the backend answers the same way whether or not the account exists.
import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSite } from '@/app/api/_lib/csrf';
import { forwardPublicAuthPost, readJson, schoolHeader } from '@/app/api/_lib/public-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const tenant = schoolHeader(request);
  if (!tenant) {
    return NextResponse.json({ detail: "Open this page from your school's sign-in page." }, { status: 400 });
  }
  const body = await readJson(request);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json({ detail: 'Enter your email address.' }, { status: 400 });
  }
  return forwardPublicAuthPost('auth/forgot-password', { email }, tenant);
}
