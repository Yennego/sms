'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTenantNavigation } from '@/hooks/use-tenant';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { tenant, createTenantPath } = useTenantNavigation();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  
  useEffect(() => {
    // Get user role from localStorage or user object
    const storedRole = localStorage.getItem('userRole');
    const role = user?.role || storedRole;
    setUserRole(role);
    
    // Redirect if not authenticated
    if (!isAuthenticated) {
      router.push(createTenantPath('/login'));
    }
  }, [isAuthenticated, user, router, createTenantPath]);
  
  const handleLogout = async () => {
    await logout();
    router.push(createTenantPath('/login'));
  };
  
  if (!isAuthenticated || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl">{tenant.name} School System</h1>
          <button 
            onClick={handleLogout}
            className="px-3 py-1 bg-blue-700 rounded hover:bg-blue-800"
          >
            Logout
          </button>
        </div>
        <nav className="mt-2">
          {userRole === 'super_admin' && (
            <Link href="/super-admin/dashboard" className="mr-4 hover:underline">Super Admin Dashboard</Link>
          )}
          {userRole === 'admin' && (() => {
            const currentPath = window.location.pathname;
            const pathMatch = currentPath.match(/^\/([a-zA-Z0-9-]+)\//); 
            const tenantDomain = pathMatch ? pathMatch[1] : tenant?.domain;
            return tenantDomain ? (
              <Link href={`/${tenantDomain}/admin-dashboard`} className="mr-4 hover:underline">Admin Dashboard</Link>
            ) : null;
          })()}
          {userRole === 'teacher' && (() => {
            const currentPath = window.location.pathname;
            const pathMatch = currentPath.match(/^\/([a-zA-Z0-9-]+)\//); 
            const tenantDomain = pathMatch ? pathMatch[1] : tenant?.domain;
            return tenantDomain ? (
              <Link href={`/${tenantDomain}/teacher/dashboard`} className="mr-4 hover:underline">Teacher Dashboard</Link>
            ) : null;
          })()}
          {userRole === 'student' && (() => {
            const currentPath = window.location.pathname;
            const pathMatch = currentPath.match(/^\/([a-zA-Z0-9-]+)\//); 
            const tenantDomain = pathMatch ? pathMatch[1] : tenant?.domain;
            return tenantDomain ? (
              <Link href={`/${tenantDomain}/student/dashboard`} className="mr-4 hover:underline">Student Dashboard</Link>
            ) : null;
          })()}
        </nav>
      </header>
      <main className="p-4">
        <div className="mb-4">
          <h2 className="text-xl">Welcome, {user?.firstName || user?.username || 'User'}</h2>
          <p>Academic Year: {tenant.currentAcademicYear || 'Current'}</p>
          {userRole === 'student' && <p>Grade: {user?.gradeLevel || 'Not specified'}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
