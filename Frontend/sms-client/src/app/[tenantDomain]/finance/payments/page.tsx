'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { PaymentsScreen } from '@/components/fees/payments-screen';

export default function PaymentsPage() {
  const params = useParams<{ tenantDomain: string }>();
  return (
    <Suspense fallback={null}>
      <PaymentsScreen school={params.tenantDomain} />
    </Suspense>
  );
}
