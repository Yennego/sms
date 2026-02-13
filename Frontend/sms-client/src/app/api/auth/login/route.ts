import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getNamespacedKey } from '@/utils/cookie-manager';
import { isValidUUID, getTenantUUIDByDomain } from '@/lib/cookies';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const headerTenantId = request.headers.get('X-Tenant-ID');

    // Log the request for debugging
    console.log('Login request:', { username, headerTenantId });

    // Normalize backend URL to include /api/v1
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

    const response = await axios.post(
      `${backendUrl}/auth/login`,
      new URLSearchParams({ username, password }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(tenantHeaderToSend && { 'X-Tenant-ID': tenantHeaderToSend }),
        },
        timeout: 95000, // 95 seconds
      }
    );

    const { data } = response;

    // Log the backend response for debugging
    console.log('Backend response:', data);

    // Handle various backend response structures
    const accessToken = data.access_token || data.accessToken || data.token;
    const refreshToken = data.refresh_token || data.refreshToken;

    // Prefer tenant from token; fallback to header or cookies
    const extractTenantFromToken = (accessToken: string): string | null => {
      try {
        const [, payloadB64] = accessToken.split('.');
        if (!payloadB64) return null;
        const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        const tenantId = payload.tenant_id;
        if (!tenantId || tenantId === 'None' || tenantId === 'null' || tenantId === 'undefined') {
          return null;
        }
        return tenantId;
      } catch {
        return null;
      }
    };

    let responseTenantId =
      (accessToken && extractTenantFromToken(accessToken)) ||
      tenantHeaderToSend ||
      request.cookies.get(getNamespacedKey('tenantId', 'TENANT'))?.value ||
      request.cookies.get(getNamespacedKey('tenantId', 'DEFAULT'))?.value ||
      null;

    // Only require tokens; tenantId may be absent for super-admin/global login
    if (!accessToken || !refreshToken) {
      console.error('Missing tokens in backend response', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
      });
      return NextResponse.json({ message: 'Missing required tokens' }, { status: 500 });
    }

    // Use TENANT context for login cookies
    const context = 'TENANT';

    // Set cookies with namespace; set tenantId only if available
    const responseObj = NextResponse.json(data);
    responseObj.cookies.set(getNamespacedKey('accessToken', context), accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    responseObj.cookies.set(getNamespacedKey('refreshToken', context), refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 14 * 24 * 60 * 60,
    });
    if (responseTenantId) {
      responseObj.cookies.set(getNamespacedKey('tenantId', context), responseTenantId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return responseObj;
  } catch (error) {
    console.error('Login API error:', error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'Login failed';
      console.log('Axios error details:', { status, message });
      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}