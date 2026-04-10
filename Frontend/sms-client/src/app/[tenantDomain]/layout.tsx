'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Loader2 } from "lucide-react";

export default function TenantLayout({ children }: { children: ReactNode }) {
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    hasInitialized, 
    isLoggingOut 
  } = useAuth();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const params = useParams();
  const pathname = usePathname();

  useEffect(() => {
    if (tenant?.name && tenant.name !== 'Loading...') {
      document.title = `${tenant.name} | School Portal`;
    }
  }, [tenant?.name]);

  const isLoginPage = pathname.endsWith('/login') || /\/login(\/|$)/.test(pathname);

  // Only show full-screen loader if we have NO tenant data at all OR authentication is still initializing. 
  // If we already have a tenant and are authenticated, don't show the loader just because tenantLoading is true (prevents flash on sub-navigation).
  const isHardLoading = (!hasInitialized || isLoggingOut || (!tenant && tenantLoading)) && !isLoginPage;

  if (isHardLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-slate-500 font-medium animate-pulse">Initializing...</p>
      </div>
    );
  }

  // Only show the unauthenticated view (no sidebar) if loading is complete and we are DEFINITELY not authenticated.
  // This prevents the "awkward" no-sidebar state during reload/initialization.
  if (!isAuthenticated || isLoginPage) {
    // If it's a login page, we never show sidebar
    if (isLoginPage) {
      return <main className="min-h-screen">{children}</main>;
    }
    
    // If we get here, it means initialization is DONE and we are NOT authenticated
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