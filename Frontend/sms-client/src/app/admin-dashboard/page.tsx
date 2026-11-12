'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { currentSchoolSlug } from '@/utils/tenant-utils';

export default function AdminDashboardRedirect() {
  const router = useRouter();
  const { user } = useAuth();
  
  useEffect(() => {
    // Check if user is super-admin
    const isSuperAdmin = 
      user?.role === 'super-admin' || 
      user?.role === 'superadmin' || 
      (Array.isArray(user?.roles) && user.roles.some(role => 
        typeof role === 'string' 
          ? (role === 'super-admin' || role === 'superadmin')
          : (role.name === 'super-admin' || role.name === 'superadmin')
      ));
      
    if (isSuperAdmin) {
      router.push('/platform/dashboard');
    } else {
      // There is no school-less dashboard: the school's address sends each role to its home, or sign in
      const school = currentSchoolSlug();
      router.push(school ? `/${school}` : '/login');
    }
  }, [router, user]);
  
  return <div>Redirecting to Dashboard...</div>;
}
