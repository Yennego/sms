import type { ReactNode } from 'react';

import { FeatureGate } from '@/components/ui/feature-gate';

// A switchable school area: while the operator has it off, the page says so (the server refuses it too)
export default function AssignmentsLayout({ children }: { children: ReactNode }) {
  return (
    <FeatureGate feature="enable_homework" label="Homework">
      {children}
    </FeatureGate>
  );
}
