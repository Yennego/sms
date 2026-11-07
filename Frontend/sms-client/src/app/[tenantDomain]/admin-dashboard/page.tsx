'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import { School } from 'lucide-react';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { contextualCookies, getCurrentContext } from '@/utils/cookie-manager';

export default function AdminDashboardPage() {
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
  
  // The school dashboard is for the admin and the principal (academic admin)
  const isAdmin = ['admin', 'tenant-admin', 'academic-admin'].includes(userRole) ||
    (Array.isArray(user?.roles) && user.roles.some((r) => ['admin', 'tenant-admin', 'academic-admin'].includes(typeof r === 'string' ? r : r.name)));
  
  useEffect(() => {
    try {
      // Store current tenant information when we have the data
      if (!tenantLoading && stableTenant) {
        const currentContext = getCurrentContext();
        contextualCookies.set('currentTenantDomain', stableTenant.domain || '', { expires: 30 }, currentContext);
        contextualCookies.set('currentTenantName', stableTenant.name || '', { expires: 30 }, currentContext);
        localStorage.setItem('currentTenantDomain', stableTenant.domain || '');
        localStorage.setItem('currentTenantName', stableTenant.name || '');
      }
      
      if (!tenantLoading && !stableTenant) {
        setError('Tenant information not found');
      }
    } catch (err) {
      setError('An error occurred while loading admin dashboard');
      console.error('Admin Dashboard error:', err);
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

  // Handle non-admin redirect
  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      // Redirect non-admin users to appropriate dashboard
      if (userRole === 'super_admin') {
        router.push('/platform/dashboard');
      } else if (userRole === 'teacher') {
        router.push(`/${stableTenant?.domain || stableTenant?.id}/teacher/dashboard`);
      } else if (userRole === 'student') {
        router.push(`/${stableTenant?.domain || stableTenant?.id}/student/dashboard`);
      } else if (userRole === 'attendance-scanner') {
        router.push(`/${stableTenant?.domain || stableTenant?.id}/attendance/scan`);
      } else if (userRole === 'parent') {
        router.push(`/${stableTenant?.domain || stableTenant?.id}/parent/attendance`);
      } else {
        router.push(`/${stableTenant?.domain || stableTenant?.id}/dashboard`);
      }
    }
  }, [user, authLoading, isAdmin, userRole, router, stableTenant]);

  // Loading, or on the way somewhere else (signed out, or another role's home)
  if (tenantLoading || authLoading || !user || (!isAdmin && !error)) {
    return (
      <PageShell title="Home">
        <Skeleton className="h-48 w-full rounded-xl" />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Home">
        <EmptyState
          icon={School}
          title="Your school didn't load"
          description="Sign in again to open your school's home."
          action={
            <Button onClick={() => router.push(stableTenant?.domain ? `/${stableTenant.domain}/login` : '/login')}>
              Go to sign-in
            </Button>
          }
        />
      </PageShell>
    );
  }

  return <AdminDashboard />;
}
