'use client';

import { Suspense } from 'react';

import { GradebookScreen } from '@/components/gradebook/gradebook-screen';

export default function GradebookPage() {
  // The screen reads its class, subject and period from the URL query.
  return (
    <Suspense fallback={null}>
      <GradebookScreen />
    </Suspense>
  );
}
