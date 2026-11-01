'use client';

// Notification settings (user menu, every role; phase6-design.md section 6): one email switch per
// event. The inbox always gets every alert; these switches only decide whether an email copy is
// sent too. Says so when the school can't send email yet, or the user has no email address.
import * as React from 'react';
import { Info, MailX } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { LoadError } from '@/components/fees/shared';
import { errorMessage } from '@/components/students/format';
import type { NotificationEvent, PreferenceItem } from '@/services/api/communication-service';

import { usePreferences, useUpdatePreferences } from './queries';

// Absence, late and payment alerts go to parents only; the server lists every event for everyone
const EVENT_HINTS: Record<NotificationEvent, string> = {
  attendance_absent: 'For parents: when their child is marked absent.',
  attendance_late: 'For parents: when their child arrives late.',
  results_published: 'When period or semester results are published.',
  payment_received: 'For parents: when the school records a fee payment.',
  announcement: 'When the school sends you an announcement.',
};

function Note({ icon: Icon, children }: { icon: typeof Info; children: React.ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="text-sm">{children}</p>
    </div>
  );
}

function PreferenceRow({
  item,
  disabled,
  saving,
  onChange,
}: {
  item: PreferenceItem;
  disabled: boolean;
  saving: boolean;
  onChange: (email: boolean) => void;
}) {
  const id = React.useId();
  return (
    <li className="flex min-h-11 items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-base font-medium text-foreground">
          {item.label}
        </label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {EVENT_HINTS[item.event] ?? ''}
        </p>
      </div>
      <Switch
        id={id}
        checked={item.email}
        disabled={disabled || saving}
        onCheckedChange={onChange}
        aria-describedby={`${id}-hint`}
        className="shrink-0"
      />
    </li>
  );
}

export function NotificationSettings() {
  const q = usePreferences();
  const update = useUpdatePreferences();
  const [savingEvent, setSavingEvent] = React.useState<string | null>(null);

  const onChange = async (event: NotificationEvent, email: boolean) => {
    setSavingEvent(event);
    try {
      await update.mutateAsync([{ event, email }]);
      notify.success(email ? 'Email turned on' : 'Email turned off');
    } catch (error) {
      notify.error(errorMessage(error, "The change wasn't saved. Check your connection and try again."));
    } finally {
      setSavingEvent(null);
    }
  };

  const data = q.data;
  const noAddress = data ? !data.email : false;
  const emailOff = data ? !data.email_configured : false;

  let content: React.ReactNode;
  if (q.isLoading) {
    content = (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading your settings">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  } else if (q.isError || !data) {
    content = <LoadError error={q.error} what="your notification settings" onRetry={() => void q.refetch()} />;
  } else {
    content = (
      <>
        {emailOff ? (
          <Note icon={MailX}>
            The school doesn&apos;t send emails yet. Your choices are kept and apply once email is set up. Alerts
            still arrive in your inbox.
          </Note>
        ) : null}
        {noAddress ? (
          <Note icon={Info}>
            Your account has no email address, so no emails are sent to you. Alerts still arrive in your inbox. To
            get emails, ask the school office to add your email address.
          </Note>
        ) : null}
        {!emailOff && !noAddress ? (
          <p className="text-sm text-muted-foreground">
            Emails go to <span className="font-medium break-all text-foreground">{data.email}</span>.
          </p>
        ) : null}
        <section aria-labelledby="email-switches" className="flex flex-col gap-3">
          <h2 id="email-switches" className="text-lg font-semibold text-foreground">
            Email me a copy
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {data.items.map((item) => (
              <PreferenceRow
                key={item.event}
                item={item}
                disabled={noAddress}
                saving={savingEvent === item.event}
                onChange={(email) => void onChange(item.event, email)}
              />
            ))}
          </ul>
        </section>
      </>
    );
  }

  return (
    <PageShell
      title="Notification settings"
      description="Every alert arrives in your inbox. Choose which ones also come by email."
      className="max-w-3xl"
    >
      {content}
    </PageShell>
  );
}
