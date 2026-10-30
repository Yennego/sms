import type { ReactNode } from 'react';

import { FeatureGate } from '@/components/ui/feature-gate';

// The Fees area's tabs come from the app shell (config/navigation.ts); each page renders its own
// PageShell heading. While the school's finance switch is off, every page here says so instead.
export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <FeatureGate feature="enable_finance" label="Fees">
      {children}
    </FeatureGate>
  );
}
