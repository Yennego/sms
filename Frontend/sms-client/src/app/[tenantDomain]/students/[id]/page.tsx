'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { isProfileTab, StudentProfile } from '@/components/students/student-profile';

function StudentProfileRoute() {
  const params = useParams<{ tenantDomain: string; id: string }>();
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = isProfileTab(requested) ? requested : 'overview';
  return <StudentProfile school={params.tenantDomain} studentId={params.id} tab={tab} />;
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={null}>
      <StudentProfileRoute />
    </Suspense>
  );
}
