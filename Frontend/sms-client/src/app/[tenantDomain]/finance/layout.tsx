import type { ReactNode } from 'react';

// The Fees area's tabs come from the app shell (config/navigation.ts); each page renders its own
// PageShell heading, so this layout adds nothing around the pages.
export default function FinanceLayout({ children }: { children: ReactNode }) {
  return children;
}
