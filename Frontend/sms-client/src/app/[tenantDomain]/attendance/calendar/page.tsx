'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useTenant } from '@/hooks/use-tenant';

// Replaced by the daily overview (pick any date there); holidays live in Settings → Attendance.
export default function RedirectPage() {
  const router = useRouter();
  const { tenant } = useTenant();

  useEffect(() => {
    if (tenant?.domain) router.replace(`/${tenant.domain}/attendance`);
  }, [tenant?.domain, router]);

  return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
}
