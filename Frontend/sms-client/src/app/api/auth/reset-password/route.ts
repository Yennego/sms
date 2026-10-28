// Public: sets a new password with the single-use token from the emailed link. The token only
// works on its own school, which comes from the page URL (sent as X-Tenant-ID).
import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSite } from '@/app/api/_lib/csrf';
import { forwardPublicAuthPost, readJson, schoolHeader } from '@/app/api/_lib/public-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const tenant = schoolHeader(request);
  if (!tenant) {
    return NextResponse.json({ detail: "Open the reset link from your email again." }, { status: 400 });
  }
  const body = await readJson(request);
  const token = typeof body?.token === 'string' ? body.token : '';
  const newPassword = typeof body?.new_password === 'string' ? body.new_password : '';
  if (!token || !newPassword) {
    return NextResponse.json({ detail: 'The reset link and a new password are required.' }, { status: 400 });
  }
  return forwardPublicAuthPost('auth/reset-password', { token, new_password: newPassword }, tenant);
}
