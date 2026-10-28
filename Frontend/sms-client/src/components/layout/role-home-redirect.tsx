'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { homePath, navigationFor } from '@/config/navigation';

/** `/{school}` and `/{school}/dashboard`: send the user to their role's home page. */
export default function RoleHomeRedirect() {
  const router = useRouter();
  const params = useParams();
  const slug = (params?.tenantDomain as string) || '';
  const { user, isAuthenticated, hasInitialized } = useAuth();
  // Roles without a home page of their own land here; don't send them in a circle
  const hasOwnHome = !!user && navigationFor(user).home !== '/dashboard';

  useEffect(() => {
    if (!hasInitialized) return;
    if (!isAuthenticated) {
      router.replace(`/${slug}/login`);
    } else if (user && hasOwnHome) {
      router.replace(homePath(user, slug));
    }
  }, [hasInitialized, isAuthenticated, user, hasOwnHome, slug, router]);

  if (hasInitialized && isAuthenticated && user && !hasOwnHome) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome</h1>
        <p className="mt-2 text-slate-600">
          Your account doesn&apos;t have a role with its own pages yet. Ask your school administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4" role="status">
      <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
      <p className="font-medium text-slate-500">Opening your home page…</p>
    </div>
  );
}
