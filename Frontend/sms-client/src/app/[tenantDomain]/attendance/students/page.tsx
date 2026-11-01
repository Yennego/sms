'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useTenant } from '@/hooks/use-tenant';

// Students are reached from a class report (attendance/reports), which links to each student's history.
export default function RedirectPage() {
  const router = useRouter();
  const { tenant } = useTenant();

  useEffect(() => {
    if (tenant?.domain) router.replace(`/${tenant.domain}/attendance/reports`);
  }, [tenant?.domain, router]);

  return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
}
