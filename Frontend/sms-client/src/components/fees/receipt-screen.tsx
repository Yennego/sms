'use client';

// Receipt page (/{school}/finance/payments/{id}): the paper-style receipt, "Print receipt"
// (A5 portrait, no app around it), a link back to the student's statement and "Void payment".
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Ban, FileSearch, Plus, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useSchoolProfile } from '@/components/school-profile/queries';
import { usePrintRequest } from '@/components/report-cards/print-root';
import { useTenant } from '@/hooks/use-tenant';
import { errorStatus } from './money';
import { useFeesPermissions, usePayment } from './queries';
import { Receipt, type ReceiptSchool } from './receipt';
import { RecordPaymentSheet } from './record-payment-sheet';
import { LoadError, PrintPortal } from './shared';
import { VoidPaymentDialog } from './void-payment-dialog';

const RECEIPT_PAGE = '@page { size: A5 portrait; margin: 8mm; }';

export function useReceiptSchool(): ReceiptSchool {
  const { tenant } = useTenant();
  const profile = useSchoolProfile().data;
  return {
    name: tenant?.name ?? 'School',
    logo: tenant?.logo ?? null,
    address: profile?.address ?? null,
    phone: profile?.phone ?? null,
    email: profile?.email ?? null,
    motto: profile?.motto ?? null,
  };
}

export function ReceiptScreen({ school, paymentId }: { school: string; paymentId: string }) {
  const q = usePayment(paymentId);
  const payment = q.data;
  const receiptSchool = useReceiptSchool();
  const perms = useFeesPermissions();
  const print = usePrintRequest();
  const [voiding, setVoiding] = React.useState(false);
  const [recording, setRecording] = React.useState(false);

  const back = (
    <Link
      href={payment ? `/${school}/finance/accounts/${payment.student_id}` : `/${school}/finance/payments`}
      className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {payment ? `Statement for ${payment.student_name ?? 'the student'}` : 'Payments'}
    </Link>
  );

  if (q.isError) {
    return (
      <PageShell title="Receipt" eyebrow={back}>
        {errorStatus(q.error) === 404 ? (
          <EmptyState
            icon={FileSearch}
            title="Receipt not found"
            description="This receipt doesn't exist in this school. Find it in the list of payments."
            action={
              <Button asChild variant="outline">
                <Link href={`/${school}/finance/payments`}>Open payments</Link>
              </Button>
            }
          />
        ) : (
          <LoadError error={q.error} what="this receipt" onRetry={() => q.refetch()} />
        )}
      </PageShell>
    );
  }

  if (!payment) {
    return (
      <PageShell title="Receipt" eyebrow={back}>
        <Skeleton className="mx-auto h-[420px] w-full max-w-[148mm]" />
      </PageShell>
    );
  }

  const voided = Boolean(payment.voided_at);
  const mayVoid = !voided && payment.can_void;
  // The receipt carries the school heading; the profile fills any gaps.
  const heading: ReceiptSchool = {
    name: payment.school?.name || receiptSchool.name,
    logo: payment.school?.logo ?? receiptSchool.logo,
    address: payment.school?.address ?? receiptSchool.address,
    phone: payment.school?.phone ?? receiptSchool.phone,
    email: payment.school?.email ?? receiptSchool.email,
    motto: payment.school?.motto ?? receiptSchool.motto,
  };

  return (
    <PageShell
      title={`Receipt ${payment.receipt_number}`}
      description={voided ? undefined : 'Print it and hand it to the family, or record another payment.'}
      eyebrow={back}
      primaryAction={
        <Button onClick={print}>
          <Printer aria-hidden="true" />
          Print receipt
        </Button>
      }
      secondaryActions={
        <>
          {perms.record ? (
            <Button variant="outline" onClick={() => setRecording(true)}>
              <Plus aria-hidden="true" />
              Record another payment
            </Button>
          ) : null}
          {mayVoid ? (
            <DropdownMenu
              label="More actions for this receipt"
              items={[{ label: 'Void payment', icon: Ban, destructive: true, onSelect: () => setVoiding(true) }]}
            />
          ) : null}
        </>
      }
    >
      {voided ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status="danger" label="Void" />
          <span className="text-muted-foreground">
            This payment no longer counts. Reason: {payment.void_reason || 'not given'}.
          </span>
        </div>
      ) : null}

      <div className="rounded-xl bg-muted/40 p-2 sm:p-6">
        <Receipt payment={payment} school={heading} />
      </div>

      <PrintPortal pageCss={RECEIPT_PAGE}>
        <Receipt payment={payment} school={heading} className="max-w-none border-2" />
      </PrintPortal>

      <VoidPaymentDialog payment={voiding ? payment : null} onOpenChange={(open) => !open && setVoiding(false)} />
      <RecordPaymentSheet school={school} open={recording} onOpenChange={setRecording} />
    </PageShell>
  );
}
