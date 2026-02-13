import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getNamespacedKey } from '@/utils/cookie-manager';
import { isValidUUID, getTenantUUIDByDomain } from '@/lib/cookies';

export async function POST(request: NextRequest) {
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

    console.log('[Login API] Attempting login for:', username, 'Tenant Header:', headerTenantId);

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

    // Extract tenantId from token if available
    const extractTenantFromToken = (token: string): string | null => {
      try {
        const [, payloadB64] = token.split('.');
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
        const tid = payload.tenant_id;
        return (tid && tid !== 'None' && tid !== 'null') ? tid : null;
      } catch { return null; }
    };

    const tokenTenantId = extractTenantFromToken(accessToken);
    const finalTenantId = tokenTenantId || tenantHeaderToSend;

    // Determine context: if super-admin or global login (no tenant), use DEFAULT or SUPER_ADMIN
    // For now, standardize on 'TENANT' for cookies to match expectations elsewhere
    const context = 'TENANT';

    const responseObj = NextResponse.json(data);

    // Set accessToken cookie (tn_accessToken)
    responseObj.cookies.set(getNamespacedKey('accessToken', context), accessToken, {
      httpOnly: true,
      secure: true, // Always secure for modern browsers/Next.js 15
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    // Set refreshToken cookie (tn_refreshToken)
    responseObj.cookies.set(getNamespacedKey('refreshToken', context), refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 14 * 24 * 60 * 60,
    });

    if (finalTenantId) {
      responseObj.cookies.set(getNamespacedKey('tenantId', context), finalTenantId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return responseObj;
  } catch (error) {
    console.error('Login API error:', error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.detail || error.response?.data?.message || error.message;
      return NextResponse.json({ message }, { status });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}