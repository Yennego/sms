'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { ReceiptScreen } from '@/components/fees/receipt-screen';

export default function ReceiptPage() {
  const params = useParams<{ tenantDomain: string; id: string }>();
  return (
    <Suspense fallback={null}>
      <ReceiptScreen school={params.tenantDomain} paymentId={params.id} />
    </Suspense>
  );
}
