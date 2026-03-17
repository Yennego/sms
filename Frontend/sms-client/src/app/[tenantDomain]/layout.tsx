'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Loader2 } from "lucide-react";

export default function TenantLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, isLoggingOut } = useAuth();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const pathname = usePathname();

  useEffect(() => {
    if (tenant?.name && tenant.name !== 'Loading...') {
      document.title = `${tenant.name} | School Portal`;
    }
  }, [tenant?.name]);

  const isLoginPage = pathname?.includes('/login');

  // Show loading while auth OR tenant is resolving, unless it's the login page
  if ((authLoading || tenantLoading || isLoggingOut) && !isLoginPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto opacity-70" />
          <p className="text-slate-500 font-medium animate-pulse">Initializing school portal...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on login page, we'll let the page level handle redirection
  // or the middleware will catch it. Here we just render the children (which might be the login page).
  if (!isAuthenticated || isLoginPage) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <Header />
        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50">
          <main className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}