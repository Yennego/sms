import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookies, readRefreshToken, setSessionFromTokens } from '@/app/api/_lib/auth-cookies';
import { isBillingRefusal, refreshTokens } from '@/app/api/_lib/backend-session';
import { rejectCrossSite } from '@/app/api/_lib/csrf';
import { trustedClientHeaders } from '@/app/api/_lib/client-ip';
import { BILLING_STATUS_HEADER } from '@/lib/billing-block';

/**
 * Exchange the httpOnly refresh cookie for new tokens. The browser sees neither token: it calls
 * this route with no body and gets back only whether the session is still alive; the new tokens
 * go straight into httpOnly cookies. A suspended school refuses its non-admins (403 with
 * X-School-Billing-Status and the reason); the session ends then too.
 */
export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const refreshToken = readRefreshToken(request, request.headers.get('X-Auth-Context'));
  if (!refreshToken) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  }

  const tokens = await refreshTokens(refreshToken, trustedClientHeaders(request));
  if (isBillingRefusal(tokens)) {
    const res = NextResponse.json(
      { message: tokens.detail, detail: tokens.detail },
      { status: 403, headers: { [BILLING_STATUS_HEADER]: tokens.billingStatus } }
    );
    clearSessionCookies(res);
    return res;
  }
  if (!tokens) {
    return NextResponse.json({ message: 'Session expired' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setSessionFromTokens(res, tokens.access_token, tokens.refresh_token);
  return res;
}
