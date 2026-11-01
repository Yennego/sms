import { NextRequest, NextResponse } from 'next/server';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';
import { trustedClientHeaders } from '@/app/api/_lib/client-ip';
import { BILLING_STATUS_HEADER } from '@/lib/billing-block';
import { getSession, preferredNamespace } from '@/lib/session';

type MeRole = { name?: string; permissions?: (string | { name?: string })[]; [key: string]: unknown };
type MeUser = {
  role?: string;
  roles?: (MeRole | string)[];
  permissions?: string[];
  [key: string]: unknown;
};

/** The signed-in user, read with the httpOnly access cookie and reshaped for the frontend. */
export async function GET(request: NextRequest) {
  const session = getSession(request.cookies, preferredNamespace(request.headers));
  if (!session) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  }

  try {
    const tenantId = request.headers.get('X-Tenant-ID');
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(`${normalizeBaseUrl(process.env.BACKEND_API_URL)}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
        ...(tenantId && tenantId !== 'undefined' && { 'X-Tenant-ID': tenantId }),
        ...trustedClientHeaders(request),
      },
      cache: 'no-store',
      signal,
    });
    cancel();

    const data = await response.json().catch(() => null);
    if (!data) {
      return NextResponse.json({ message: 'Invalid response from backend' }, { status: 502 });
    }
    if (!response.ok) {
      // A suspended school refuses its non-admins: pass the status on so the app signs out with the reason
      const billingStatus = response.headers.get(BILLING_STATUS_HEADER);
      return NextResponse.json(
        { message: data.detail || 'Failed to fetch user data', ...(billingStatus && { detail: data.detail }) },
        { status: response.status, ...(billingStatus && { headers: { [BILLING_STATUS_HEADER]: billingStatus } }) }
      );
    }

    // snake_case → camelCase for the frontend
    const {
      first_name, last_name, phone_number, profile_picture, is_active, is_first_login,
      last_login, created_at, updated_at, tenant_id, ...rest
    } = data;
    const user: MeUser = {
      ...rest,
      firstName: first_name,
      lastName: last_name,
      phone: phone_number,
      profileImage: profile_picture,
      isActive: is_active,
      isFirstLogin: is_first_login,
      lastLogin: last_login,
      createdAt: created_at,
      updatedAt: updated_at,
      tenantId: tenant_id,
    };

    // 'tenant-admin' is shown as 'admin'; role defaults to the first role
    const roles: MeRole[] = (Array.isArray(user.roles) ? user.roles : [])
      .map(r => (typeof r === 'string' ? { name: r } : r))
      .map(r => ({ ...r, name: r?.name === 'tenant-admin' ? 'admin' : r?.name }));
    user.roles = roles;
    if (!user.role && roles.length) user.role = roles[0].name;
    if (user.role === 'tenant-admin') user.role = 'admin';

    // Permissions from all roles, merged with any the backend sent directly
    const fromRoles = roles.flatMap(r =>
      Array.isArray(r.permissions)
        ? r.permissions.map(p => (typeof p === 'string' ? p : p?.name)).filter((p): p is string => !!p)
        : []);
    user.permissions = Array.from(new Set([...(Array.isArray(user.permissions) ? user.permissions : []), ...fromRoles]));

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ message: 'Upstream timeout' }, { status: 504 });
    }
    console.error('[/api/auth/me]', error instanceof Error ? error.message : error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
