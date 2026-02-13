'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import TeacherDashboard from '@/components/dashboards/TeacherDashboard';
import StudentDashboard from '@/components/dashboards/StudentDashboard';
import SuperAdminDashboard from '@/components/dashboards/SuperAdminDashboard';

export default function TenantDashboardPage() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  // Stabilize tenant object to prevent unnecessary re-renders
  const stableTenant = useMemo(() => {
    if (!tenant) return null;
    return {
      domain: tenant.domain,
      name: tenant.name,
      id: tenant.id
    };
  }, [tenant]);
  
  // Get user role early to use in hooks
  const userRole = user?.role || 
    (Array.isArray(user?.roles) && user.roles.length > 0 ? 
      (typeof user.roles[0] === 'string' ? 
        user.roles[0] : 
        user.roles[0].name) : 
      'admin');
  
  const isSuperAdmin = userRole === 'super_admin';
  
  useEffect(() => {
    try {
      // Store current tenant information when we have the data
      if (!tenantLoading && stableTenant) {
        localStorage.setItem('currentTenantDomain', stableTenant.domain || '');
        localStorage.setItem('currentTenantName', stableTenant.name || '');
      }
      
      if (!tenantLoading && !stableTenant) {
        setError('Tenant information not found');
      }
    } catch (err) {
      setError('An error occurred while loading dashboard');
      console.error('Dashboard error:', err);
    }
  }, [tenantLoading, stableTenant]);

  // Handle redirect to login if no user
  useEffect(() => {
    if (!authLoading && !user) {
      // Check if we have tenant info to determine redirect path
      if (stableTenant?.domain) {
        router.push(`/${stableTenant.domain}/login`);
      } else {
        // Fallback to root login if no tenant domain
        router.push('/login');
      }
    }
  }, [user, authLoading, router, stableTenant]);

  // Handle super-admin redirect - moved to hooks section
  useEffect(() => {
    if (!authLoading && user && isSuperAdmin) {
      router.push('/login');
    }
  }, [user, authLoading, isSuperAdmin, router]);

  // Show loading state
  if (tenantLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Dashboard...</h2>
          <p className="text-gray-500">Please wait while we prepare your dashboard.</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    const getLoginPath = () => {
      if (stableTenant?.domain) {
        return `/${stableTenant.domain}/login`;
      }
      return '/login';
    };

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Error</h2>
          <p className="text-gray-700">{error}</p>
          <button 
            onClick={() => router.push(getLoginPath())} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Return loading state if no user (while redirect is happening)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
          <p className="text-gray-500">Please wait...</p>
        </div>
      </div>
    );
  }

  // Determine role-based flags
  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher';
  const isStudent = userRole === 'student';

  // Render appropriate dashboard component based on role
  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  } else if (isAdmin) {
    return <AdminDashboard />;
  } else if (isTeacher) {
    return <TeacherDashboard />;
  } else if (isStudent) {
    return <StudentDashboard />;
  }
  
  // Fallback for unknown roles
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-4">Welcome to the school management system.</p>
      <p className="mt-2 text-sm text-gray-600">Role: {userRole}</p>
    </div>
  );
}
