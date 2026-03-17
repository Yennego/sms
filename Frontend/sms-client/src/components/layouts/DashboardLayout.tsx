'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTenantNavigation } from '@/hooks/use-tenant';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { tenant, createTenantPath } = useTenantNavigation();
  const { selectedAcademicYearName } = useAcademicYear();
  const router = useRouter();
  
  const role = useMemo(() => {
    if (!user) return null;
    if (user.role) return user.role;
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      return typeof user.roles[0] === 'string' ? user.roles[0] : user.roles[0].name;
    }
    return null;
  }, [user]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(createTenantPath('/login'));
    }
  }, [isAuthenticated, authLoading, router, createTenantPath]);
  
  const handleLogout = async () => {
    await logout();
  };
  
  if (authLoading || !isAuthenticated || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto opacity-50" />
          <p className="text-gray-500 font-medium">Loading...</p>
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
        <nav className="mt-2 flex gap-4">
          {(role === 'super_admin' || role === 'superadmin') && (
            <Link href="/super-admin/dashboard" className="hover:underline">Super Admin Dashboard</Link>
          )}
          {role === 'admin' && (
            <Link href={createTenantPath('/admin-dashboard')} className="hover:underline">Admin Dashboard</Link>
          )}
          {role === 'teacher' && (
            <Link href={createTenantPath('/teacher/dashboard')} className="hover:underline">Teacher Dashboard</Link>
          )}
          {role === 'student' && (
            <Link href={createTenantPath('/student/dashboard')} className="hover:underline">Student Dashboard</Link>
          )}
        </nav>
      </header>
      <main className="p-4">
        <div className="mb-4">
          <h2 className="text-xl">Welcome, {user?.firstName || user?.email || 'User'}</h2>
          <p>Academic Year: {selectedAcademicYearName || 'Current'}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
