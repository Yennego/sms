'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { PlatformShell } from '@/components/layout/app-shell';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoggingOut, hasInitialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Bypass auth checks for login page
    if (pathname === '/super-admin/login') {
      return;
    }

    if (hasInitialized && !hasRedirected.current) {
      if (!isAuthenticated) {
        hasRedirected.current = true;
        router.push('/super-admin/login');
        return;
      }

      // Consistent super-admin role checking
      const isSuperAdmin =
        user?.role === 'superadmin' ||
        user?.role === 'super-admin' ||
        (Array.isArray(user?.roles) && user.roles.some(role =>
          typeof role === 'string'
            ? (role === 'superadmin' || role === 'super-admin')
            : (role.name === 'superadmin' || role.name === 'super-admin')
        ));

      // Only redirect non-super-admins once
      if (!isSuperAdmin) {
        // School accounts belong on their school's pages
        hasRedirected.current = true;
        router.push('/');
        return;
      }
    }
  }, [isAuthenticated, hasInitialized, user, router, pathname]);

  if (!hasInitialized || isLoggingOut) {
    // If we are redirecting to login, don't spin
    if (pathname?.includes('/login')) return null;

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg font-medium animate-pulse">Initializing...</div>
      </div>
    );
  }

  // Final role check before rendering
  const isSuperAdmin =
    user?.role === 'superadmin' ||
    user?.role === 'super-admin' ||
    (Array.isArray(user?.roles) && user.roles.some(role =>
      typeof role === 'string'
        ? (role === 'superadmin' || role === 'super-admin')
        : (role.name === 'superadmin' || role.name === 'super-admin')
    ));

  // Bypass render check for login page
  if (pathname === '/super-admin/login') {
    return <>{children}</>;
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return null;
  }

  return (
    <ErrorBoundary>
      <NuqsAdapter>
        <PlatformShell>
          <ErrorBoundary>{children}</ErrorBoundary>
        </PlatformShell>
      </NuqsAdapter>
    </ErrorBoundary>
  );
}