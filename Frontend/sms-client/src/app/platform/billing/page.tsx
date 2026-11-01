'use client';

import { Suspense } from 'react';

import { PlatformOverviewScreen } from '@/components/billing/platform-overview-screen';

export default function PlatformBillingPage() {
  return (
    <Suspense fallback={null}>
      <PlatformOverviewScreen />
    </Suspense>
  );
}
