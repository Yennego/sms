'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { StatementScreen } from '@/components/fees/statement-screen';

export default function StatementPage() {
  const params = useParams<{ tenantDomain: string; studentId: string }>();
  return (
    <Suspense fallback={null}>
      <StatementScreen school={params.tenantDomain} studentId={params.studentId} />
    </Suspense>
  );
}
