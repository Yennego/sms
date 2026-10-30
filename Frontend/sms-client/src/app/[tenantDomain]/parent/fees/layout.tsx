import type { ReactNode } from 'react';

import { FeatureGate } from '@/components/ui/feature-gate';

// Fees and receipts show only while the school's finance switch is on.
export default function ParentFeesLayout({ children }: { children: ReactNode }) {
  return (
    <FeatureGate feature="enable_finance" label="Fees">
      {children}
    </FeatureGate>
  );
}
