'use client';

import { Suspense } from 'react';

import { PlatformInvoicesScreen } from '@/components/billing/platform-invoices-screen';

export default function PlatformInvoicesPage() {
  return (
    <Suspense fallback={null}>
      <PlatformInvoicesScreen />
    </Suspense>
  );
}
