'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { AccountsScreen } from '@/components/fees/accounts-screen';

export default function StudentAccountsPage() {
  const params = useParams<{ tenantDomain: string }>();
  // The screen reads its view (tab, filters, page, year) from the URL query.
  return (
    <Suspense fallback={null}>
      <AccountsScreen school={params.tenantDomain} />
    </Suspense>
  );
}
