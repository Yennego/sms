'use client';

import { Suspense } from 'react';

import { DeliveryLogScreen } from '@/components/communication/delivery-log-screen';

export default function DeliveryLogPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryLogScreen />
    </Suspense>
  );
}
