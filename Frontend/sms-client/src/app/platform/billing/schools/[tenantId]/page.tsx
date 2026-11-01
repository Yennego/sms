'use client';

import { useParams } from 'next/navigation';

import { PlatformSchoolScreen } from '@/components/billing/platform-school-screen';

export default function PlatformSchoolBillingPage() {
  const params = useParams<{ tenantId: string }>();
  return <PlatformSchoolScreen tenantId={params?.tenantId ?? ''} />;
}
