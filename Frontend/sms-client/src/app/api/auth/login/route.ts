import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getNamespacedKey } from '@/utils/cookie-manager';
import { isValidUUID, getTenantUUIDByDomain } from '@/lib/cookies';
import { decodeJwtPayload, setSessionFromTokens } from '@/app/api/_lib/auth-cookies';
import { rejectCrossSite } from '@/app/api/_lib/csrf';
import { trustedClientHeaders } from '@/app/api/_lib/client-ip';
import { BILLING_STATUS_HEADER } from '@/lib/billing-block';

export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  try {
    // Robustly extract credentials from various formats
    let username = '';
    let password = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      username = body.username;
      password = body.password;
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      username = formData.get('username') as string;
      password = formData.get('password') as string;
    } else {
      // Fallback: try to parse as text if unknown
      const text = await request.text();
      const params = new URLSearchParams(text);
      username = params.get('username') || '';
      password = params.get('password') || '';
    }

    const headerTenantId = request.headers.get('X-Tenant-ID');


    let backendUrl = process.env.BACKEND_API_URL || '';
    if (!backendUrl) {
      console.error('BACKEND_API_URL is not set');
      return NextResponse.json({ message: 'Backend configuration error' }, { status: 500 });
    }
    if (!backendUrl.endsWith('/api/v1')) {
      backendUrl = backendUrl.replace(/\/+$/, '') + '/api/v1';
    }

    // Resolve tenant for header if not provided
    let tenantHeaderToSend: string | null = headerTenantId || null;
    if (!tenantHeaderToSend) {
      // Try to get tenantId from cookies or resolve from subdomain
      const cookieTenant =
        request.cookies.get(getNamespacedKey('tenantId', 'TENANT'))?.value ||
        request.cookies.get(getNamespacedKey('tenantId', 'DEFAULT'))?.value ||
        request.cookies.get('tenantId')?.value ||
        null;

      if (cookieTenant) {
        tenantHeaderToSend = isValidUUID(cookieTenant)
          ? cookieTenant
          : await getTenantUUIDByDomain(cookieTenant);
      }
    }

    // Call backend
    const response = await axios.post(
      `${backendUrl}/auth/login`,
      new URLSearchParams({ username, password }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(tenantHeaderToSend && { 'X-Tenant-ID': tenantHeaderToSend }),
          ...trustedClientHeaders(request),
        },
        timeout: 95000,
      }
    );

    const data = response.data;
    const accessToken = data.access_token || data.accessToken || data.token;
    const refreshToken = data.refresh_token || data.refreshToken;

    if (!accessToken || !refreshToken) {
      console.error('Missing tokens in backend response');
      return NextResponse.json({ message: 'Missing required tokens' }, { status: 500 });
    }

    // Both tokens go only into httpOnly cookies, never into the response body. The token carries
    // the user's own school; super-admins get SUPER_ADMIN cookies, everyone else TENANT.
    const payload = decodeJwtPayload(accessToken);
    const responseObj = NextResponse.json({
      token_type: 'bearer',
      is_super_admin: payload.is_super_admin === true,
      tenant_id: payload.tenant_id ?? null,
    });
    setSessionFromTokens(responseObj, accessToken, refreshToken, tenantHeaderToSend);
    return responseObj;
  } catch (error) {
    console.error('Login API error:', axios.isAxiosError(error) ? `${error.response?.status} ${error.message}` : error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.detail || error.response?.data?.message || error.message;
      // A suspended school lets only its admins sign in: keep the status and the reason for the login page
      const billingStatus = error.response?.headers?.[BILLING_STATUS_HEADER];
      if (status === 403 && typeof billingStatus === 'string' && billingStatus) {
        return NextResponse.json(
          { message, detail: message },
          { status, headers: { [BILLING_STATUS_HEADER]: billingStatus } }
        );
      }
      return NextResponse.json({ message }, { status });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}