'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar';
import SuperAdminHeader from '@/components/layout/SuperAdminHeader';
import ErrorBoundary from '@/components/common/ErrorBoundary';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading, accessToken, isLoggingOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('superadmin-sidebar-collapsed');
    if (savedCollapsed !== null) {
      setIsSidebarCollapsed(JSON.parse(savedCollapsed));
    }
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('superadmin-sidebar-collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isLoading && !hasRedirected.current) {
      if (!isAuthenticated || !accessToken) {
        hasRedirected.current = true;
        router.push('/login');
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
        hasRedirected.current = true;
        router.push('/dashboard');
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, accessToken, router]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSidebarCollapse = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  if (isLoading || isLoggingOut) {
    // If we are redirecting to login, don't spin
    if (pathname?.includes('/login')) return null;

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
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

  if (!isAuthenticated || !isSuperAdmin) {
    return null;
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex overflow-hidden bg-gray-100">
        <SuperAdminSidebar
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          isCollapsed={isSidebarCollapsed}
          onCollapse={handleSidebarCollapse}
        />

        {/* Main content area - no margin needed now */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <SuperAdminHeader onMenuToggle={toggleSidebar} />
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}