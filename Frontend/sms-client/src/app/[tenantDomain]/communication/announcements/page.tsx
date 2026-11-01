'use client';

import { Suspense } from 'react';

import { AnnouncementsScreen, AnnouncementsSkeleton } from '@/components/communication/announcements-screen';

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<AnnouncementsSkeleton />}>
      <AnnouncementsScreen />
    </Suspense>
  );
}
