'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading, isLoggingOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only handle authentication, not role-based redirects
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // Smart super-admin redirect - only from exact /dashboard path
    if (!isLoading && isAuthenticated && user && pathname === '/dashboard') {
      const isSuperAdmin =
        user?.role === 'superadmin' ||
        user?.role === 'super-admin' ||
        (Array.isArray(user?.roles) && user.roles.some(role =>
          typeof role === 'string'
            ? (role === 'superadmin' || role === 'super-admin')
            : (role.name === 'superadmin' || role.name === 'super-admin')
        ));

      // Only redirect super-admins from /dashboard to their dedicated dashboard
      if (isSuperAdmin) {
        router.replace('/super-admin/dashboard');
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, router, pathname]);

  if (isLoading || isLoggingOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}