'use client';

import { useParams } from 'next/navigation';

import { SchoolProfile } from '@/components/school-profile/school-profile';

export default function SchoolProfilePage() {
  const params = useParams<{ tenantDomain: string }>();
  return <SchoolProfile school={params?.tenantDomain ?? ''} />;
}
