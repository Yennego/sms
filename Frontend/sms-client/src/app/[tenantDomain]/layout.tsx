'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function TenantLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isLoggingOut } = useAuth();
  const { tenant } = useTenant();
  const pathname = usePathname();

  useEffect(() => {
    if (tenant?.name) {
      document.title = `${tenant.name} | School Portal`;
    }
  }, [tenant?.name]);

  // Prevent layout flash on login page even if authenticated (before redirect)
  const isLoginPage = pathname?.includes('/login');

  if (isLoading || isLoggingOut) {
    // If we have already reached the login page, don't show the spinner
    if (isLoginPage) return children;

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || isLoginPage) {
    return children; // For login pages, etc.
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