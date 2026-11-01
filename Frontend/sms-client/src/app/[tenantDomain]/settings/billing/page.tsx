'use client';

import { useParams } from 'next/navigation';

import { SchoolBillingScreen } from '@/components/billing/school-billing-screen';

export default function BillingSettingsPage() {
  const params = useParams<{ tenantDomain: string }>();
  return <SchoolBillingScreen school={params?.tenantDomain ?? ''} />;
}
