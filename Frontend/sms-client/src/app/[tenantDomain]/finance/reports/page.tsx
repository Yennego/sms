'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { ReportsScreen } from '@/components/fees/reports-screen';

export default function FeeReportsPage() {
  const params = useParams<{ tenantDomain: string }>();
  return (
    <Suspense fallback={null}>
      <ReportsScreen school={params.tenantDomain} />
    </Suspense>
  );
}
