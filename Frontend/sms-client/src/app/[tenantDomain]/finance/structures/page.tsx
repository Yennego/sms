'use client';

import { Suspense } from 'react';

import { FeeSetupScreen } from '@/components/fees/fee-setup-screen';

export default function FeeSetupPage() {
  return (
    <Suspense fallback={null}>
      <FeeSetupScreen />
    </Suspense>
  );
}
