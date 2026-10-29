'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useTenantNavigation } from '@/hooks/use-tenant';
import { isPlatformPath } from '@/config/reserved-slugs';
import { currentSchoolSlug } from '@/utils/tenant-utils';

function normalizeRole(user: any): string | null {
  if (!user) return null;
  const base = (user.role || '').toLowerCase();
  if (base) return base;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const first = roles[0];
  const name = typeof first === 'string' ? first : first?.name;
  return (name || '').toLowerCase();
}

export default function SessionExpiredPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createTenantPath } = useTenantNavigation();

  const currentPathIsSuperAdmin = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isPlatformPath(window.location.pathname);
  }, []);

  const userRole = useMemo(() => normalizeRole(user), [user]);

  const isSuperAdmin =
    currentPathIsSuperAdmin ||
    (userRole === 'superadmin' || userRole === 'super-admin' || userRole === 'super_admin');

  const isTenantRole =
    !isSuperAdmin &&
    (userRole === 'admin' ||
      userRole === 'tenant-admin' ||
      userRole === 'teacher' ||
      userRole === 'student' ||
      userRole === 'parent');

  // The session is gone, so the user (and their role) usually is too: send people back to the
  // sign-in page of the school in the address (/{school}/session-expired) or the last school
  // they used. Worked out after mount so server and browser render the same first.
  const [loginPath, setLoginPath] = useState('/login');
  useEffect(() => {
    if (isSuperAdmin) {
      setLoginPath('/platform/login');
      return;
    }
    const slug = currentSchoolSlug();
    if (slug) setLoginPath(`/${slug}/login`);
    else if (isTenantRole) setLoginPath(createTenantPath('/login'));
  }, [isSuperAdmin, isTenantRole, createTenantPath]);

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('sessionExpired');
      if (flag === '1') sessionStorage.removeItem('sessionExpired');
    } catch {}
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">Session Expired</h1>
        <p className="text-gray-600 mb-6">
          Your session has expired due to inactivity. Please log in to continue.
        </p>
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => router.push(loginPath)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
          >
            Back to Home
          </Link>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          If this keeps happening, please contact your administrator.
        </p>
      </div>
    </div>
  );
}