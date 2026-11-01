'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { ClassPlacementScreen } from '@/components/class-placement/class-placement-screen';

export default function ClassPlacementPage() {
  const params = useParams<{ tenantDomain: string }>();
  // The screen reads its view (tab, filters, page) from the URL query.
  return (
    <Suspense fallback={null}>
      <ClassPlacementScreen school={params.tenantDomain} />
    </Suspense>
  );
}
