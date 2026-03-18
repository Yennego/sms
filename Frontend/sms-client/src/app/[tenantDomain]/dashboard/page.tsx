'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import TeacherDashboard from '@/components/dashboards/TeacherDashboard';
import StudentDashboard from '@/components/dashboards/StudentDashboard';
import SuperAdminDashboard from '@/components/dashboards/SuperAdminDashboard';
import { Loader2 } from "lucide-react";

export default function TenantDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const tenantDomain = (params?.tenantDomain as string) || "";
  
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user, isAuthenticated, isLoading: authLoading, hasInitialized } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Derive role
  const userRole = useMemo(() => {
    if (!user) return 'admin';
    if (user.role) return user.role;
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      return typeof user.roles[0] === 'string' ? user.roles[0] : user.roles[0].name;
    }
    return 'admin';
  }, [user]);

  const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin';

  useEffect(() => {
    // Wait for everything to initialize
    if (!hasInitialized || tenantLoading) {
      console.log("[Dashboard Status] Initializing...", { hasInitialized, tenantLoading, authLoading });
      return;
    }

    console.log("[Dashboard Status] Initialization complete.", { 
      isAuthenticated, 
      userEmail: user?.email, 
      tenantDomain 
    });

    if (!isAuthenticated) {
      console.log("[Dashboard] Not authenticated after initialization. Redirecting to login...");
      setIsRedirecting(true);
      const loginPath = tenantDomain ? `/${tenantDomain}/login` : "/login";
      router.push(loginPath);
      return;
    }

    if (isSuperAdmin) {
      console.log("[Dashboard] Super admin in tenant context. Redirecting to super-admin dashboard...");
      setIsRedirecting(true);
      router.push('/super-admin/dashboard');
    }
  }, [isAuthenticated, hasInitialized, tenantLoading, isSuperAdmin, router, tenantDomain, user, authLoading]);

  if (tenantLoading || authLoading || isRedirecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-slate-500 font-medium animate-pulse">
          {isRedirecting ? "Redirecting..." : "Preparing your dashboard..."}
        </p>
      </div>
    );
  }

  // Render based on role
  if (userRole === 'admin') return <AdminDashboard />;
  if (userRole === 'teacher') return <TeacherDashboard />;
  if (userRole === 'student') return <StudentDashboard />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-slate-600 font-medium">Welcome to the school management system.</p>
      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg inline-block">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Role: {userRole}</span>
      </div>
    </div>
  );
}
