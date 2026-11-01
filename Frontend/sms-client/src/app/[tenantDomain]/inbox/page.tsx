'use client';

import { Suspense } from 'react';

import { InboxScreen, InboxSkeleton } from '@/components/communication/inbox-screen';

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxScreen />
    </Suspense>
  );
}
