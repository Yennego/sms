'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { YearSetupWizard } from '@/components/year-setup/year-setup-wizard';

/** Classes → Setup: the school-year setup wizard (docs/remodel/03-app-flow.md §4.2). */
export default function YearSetupPage() {
  const params = useParams<{ tenantDomain: string }>();
  return (
    <Suspense fallback={null}>
      <YearSetupWizard school={params.tenantDomain} />
    </Suspense>
  );
}
