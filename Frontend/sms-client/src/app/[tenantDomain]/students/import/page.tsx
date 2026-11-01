'use client';

import { useParams } from 'next/navigation';

import { ImportWizard } from '@/components/students/import-wizard';

export default function ImportStudentsPage() {
  const params = useParams<{ tenantDomain: string }>();
  return <ImportWizard school={params.tenantDomain} />;
}
