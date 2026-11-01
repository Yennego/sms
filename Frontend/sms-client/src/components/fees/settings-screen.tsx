'use client';

// Finance settings (/{school}/finance/settings): whether report cards are held while a student
// has overdue fees (phase5-design.md section 1). Saved as soon as the switch changes.
import * as React from 'react';

import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/components/ui/toaster';
import { errorMessage } from '@/components/students/format';
import { useFeesPermissions, useFinanceSettings, useUpdateFinanceSettings } from './queries';
import { LoadError } from './shared';

export function SettingsScreen() {
  const perms = useFeesPermissions();
  const q = useFinanceSettings();
  const update = useUpdateFinanceSettings();
  const switchId = React.useId();
  const descId = React.useId();

  const onChange = async (checked: boolean) => {
    try {
      await update.mutateAsync({ hold_report_cards_on_arrears: checked });
      notify.success(checked ? 'Report cards are now held when fees are overdue' : 'Report cards are no longer held for fees');
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't save the setting. Check your connection and try again."));
    }
  };

  return (
    <PageShell title="Fee settings" description="How fees affect the rest of the school app.">
      {q.isError ? (
        <LoadError error={q.error} what="fee settings" onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-32 max-w-2xl" />
      ) : (
        <section className="flex max-w-2xl items-start justify-between gap-4 rounded-xl border bg-card p-4">
          <div className="grid gap-2">
            <label htmlFor={switchId} className="text-base font-medium text-foreground">
              Hold report cards when fees are overdue
            </label>
            <div id={descId} className="grid gap-2 text-sm text-muted-foreground">
              <p>
                When this is on, a student and their parents can&apos;t open or print the report card while the
                student has an installment past its due date and not fully paid. They see: “This report card is held
                until school fees are paid. Please contact the school office.”
              </p>
              <p>
                Staff always see every report card, and the verification page for printed report cards keeps
                working. When it is off, fees never affect report cards.
              </p>
              {!perms.manage ? (
                <p className="text-foreground">Only staff who manage finance settings can change this.</p>
              ) : null}
            </div>
          </div>
          <Switch
            id={switchId}
            aria-describedby={descId}
            checked={q.data.hold_report_cards_on_arrears}
            disabled={!perms.manage || update.isPending}
            onCheckedChange={onChange}
            className="mt-1"
          />
        </section>
      )}
    </PageShell>
  );
}
