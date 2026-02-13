import { NextRequest, NextResponse } from 'next/server';
import '@/app/api/_lib/undici';
import { normalizeBaseUrl, createTimeoutSignal } from '@/app/api/_lib/http';

export async function GET(request: NextRequest) {
  try {
    // Debug environment variable
    console.log('--- Entering /api/auth/me Next.js API route ---');
    console.log('BACKEND_API_URL:', process.env.BACKEND_API_URL);

    // Get tenant ID from header (set by middleware)
    const tenantId = request.headers.get('X-Tenant-ID') || '00000000-0000-0000-0000-000000000001';
    console.log('Tenant ID from header:', tenantId);

    // Ensure it's not the string "undefined"
    const sanitizedTenantId = tenantId === 'undefined' ? '00000000-0000-0000-0000-000000000001' : tenantId;
    console.log('Sanitized Tenant ID:', sanitizedTenantId);

    // Get authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { message: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Ensure BACKEND_API_URL is available
    const backendUrl = process.env.BACKEND_API_URL;
    if (!backendUrl) {
      console.error('BACKEND_API_URL environment variable is not set');
      return NextResponse.json(
        { message: 'Backend configuration error' },
        { status: 500 }
      );
    }

    // Normalize base to include /api/v1
    let baseUrl = normalizeBaseUrl(backendUrl);
    const fullUrl = `${baseUrl}/auth/me`;
    console.log('Calling backend URL:', fullUrl);

    // Call backend API
    const { signal, cancel } = createTimeoutSignal(90_000);
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'X-Tenant-ID': tenantId,
      },
      signal,
    });
    cancel();

    // Get the response as text first
    const responseText = await response.text();

    // Log the raw response for debugging
    console.log('Response from FastAPI (raw text) for /api/auth/me:');
    console.log('Raw response status:', response.status);
    console.log('Raw response headers:', Object.fromEntries(response.headers.entries()));
    console.log('Raw response text (first 200 chars):', responseText.substring(0, 200));

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      return NextResponse.json(
        { message: 'Invalid response from backend (not valid JSON)' },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.log("FastAPI response was not ok, Status:", response.status)
      return NextResponse.json(
        { message: data.detail || 'Failed to fetch user data' },
        { status: response.status }
      );
    }

    // Process the user data to ensure role is properly set
    if (data) {
      // Transform snake_case to camelCase for frontend compatibility
      const transformedData = {
        ...data,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone_number,
        profileImage: data.profile_picture,
        isActive: data.is_active,
        isFirstLogin: data.is_first_login,
        lastLogin: data.last_login,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        tenantId: data.tenant_id
      };

      // Remove snake_case fields to avoid confusion
      delete transformedData.first_name;
      delete transformedData.last_name;
      delete transformedData.phone_number;
      delete transformedData.profile_picture;
      delete transformedData.is_active;
      delete transformedData.is_first_login;
      delete transformedData.last_login;
      delete transformedData.created_at;
      delete transformedData.updated_at;
      delete transformedData.tenant_id;

      data = transformedData;

      // If roles array exists but role is missing, set role from the first role
      if (!data.role && data.roles && data.roles.length > 0) {
        data.role = typeof data.roles[0] === 'string' ?
          data.roles[0] :
          data.roles[0].name;
      }

      // Normalize tenant-admin to admin
      if (data.role === 'tenant-admin') {
        data.role = 'admin';
      }
      if (Array.isArray(data.roles)) {
        data.roles = data.roles.map((r: any) => ({
          ...r,
          name: r?.name === 'tenant-admin' ? 'admin' : r?.name
        }));
      }

      // If email contains 'superadmin', ensure role is set to 'superadmin'
      if (data.email && data.email.includes('superadmin')) {
        data.role = 'superadmin';
      }

      // Ensure super-admin users have the correct role
      if (data.role === 'superadmin' || data.role === 'super-admin') {
        console.log('Super-admin user authenticated');
        // DO NOT override tenantId - use what comes from the database
        console.log('Super-admin tenant ID from database:', data.tenantId);
      }

      // Compute permissions from roles, and attach to user
      const permissionsFromRoles =
        Array.isArray(data.roles)
          ? Array.from(
            new Set(
              data.roles.flatMap((r: any) =>
                Array.isArray(r?.permissions)
                  ? r.permissions
                    .map((p: any) => (typeof p === 'string' ? p : p?.name))
                    .filter(Boolean)
                  : []
              )
            )
          )
          : [];

      // Ensure user.permissions exists and is deduped
      const existingPermissions =
        Array.isArray((data as any).permissions) ? (data as any).permissions : [];
      (data as any).permissions = Array.from(
        new Set([...(existingPermissions || []), ...permissionsFromRoles])
      );

      console.log('Processed user data with role:', data.role);
      console.log('Computed permissions:', (data as any).permissions);
    }

    console.log('Returning JSON response to frontend from /api/auth/me.');
    return NextResponse.json(data);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return NextResponse.json(
        { message: 'Upstream timeout' },
        { status: 504 }
      );
    }
    console.error('Unhandled error in /api/auth/me Next.js API route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    console.log('--- Exiting /api/auth/me Next.js API route ---');
  }
}
