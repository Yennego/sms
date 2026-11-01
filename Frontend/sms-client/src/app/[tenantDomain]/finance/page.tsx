'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { OverviewScreen } from '@/components/fees/overview-screen';

export default function FeesOverviewPage() {
  const params = useParams<{ tenantDomain: string }>();
  return (
    <Suspense fallback={null}>
      <OverviewScreen school={params.tenantDomain} />
    </Suspense>
  );
}
