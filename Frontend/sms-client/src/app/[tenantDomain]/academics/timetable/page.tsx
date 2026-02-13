'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function TimetableAliasPage() {
  const router = useRouter();
  const params = useParams();
  const tenantDomain = params.tenantDomain as string;

  useEffect(() => {
    if (tenantDomain) {
      router.replace(`/${tenantDomain}/academics/timetables`);
    }
  }, [tenantDomain, router]);

  return null;
}