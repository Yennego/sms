'use client';

import { useParams } from 'next/navigation';

import { AdmissionForm } from '@/components/students/admission-form';

export default function AdmitStudentPage() {
  const params = useParams<{ tenantDomain: string }>();
  return <AdmissionForm school={params.tenantDomain} />;
}
