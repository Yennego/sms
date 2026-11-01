'use client';

import { useParams } from 'next/navigation';

import { StudentDirectory } from '@/components/students/student-directory';

export default function StudentsPage() {
  const params = useParams<{ tenantDomain: string }>();
  return <StudentDirectory school={params.tenantDomain} />;
}
