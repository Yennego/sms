'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

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
      router.push('/super-admin/dashboard');
    } else {
      router.push('/dashboard?role=admin');
    }
  }, [router, user]);
  
  return <div>Redirecting to Dashboard...</div>;
}
