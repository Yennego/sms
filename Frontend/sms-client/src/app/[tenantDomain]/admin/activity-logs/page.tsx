'use client';

// The school's audit log: who added, changed or deleted what (filters and page in the URL).

import { Suspense } from 'react';

import { AuditLogScreen } from '@/components/admin/audit-log-screen';

export default function ActivityLogsPage() {
  return (
    <Suspense fallback={null}>
      <AuditLogScreen />
    </Suspense>
  );
}
