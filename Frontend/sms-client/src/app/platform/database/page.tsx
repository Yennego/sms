'use client';

// No database or backup endpoint exists yet, so this page shows no figures and no backup buttons.

import { Database } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';

export default function DatabasePage() {
  return (
    <PageShell title="Database">
      <EmptyState
        icon={Database}
        title="Not available yet"
        description="Database figures and backups can't be shown here yet."
      />
    </PageShell>
  );
}
