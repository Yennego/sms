'use client';

// No platform settings endpoint exists yet: server settings such as email come from the backend's
// environment (SMTP_* in src/core/config.py), so this page says so instead of a form that saves nothing.

import { Settings } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';

export default function SystemSettingsPage() {
  return (
    <PageShell title="System settings">
      <EmptyState
        icon={Settings}
        title="Not available yet"
        description="System settings can't be changed here yet. Email settings are set in the server configuration."
      />
    </PageShell>
  );
}
