'use client';

// The invoice and receipt pages, on the school's side (/{school}/settings/billing/...) and the
// operator's (/platform/billing/...): the paper-style copy and "Print" (no app around it).
import * as React from 'react';
import { FileSearch, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { usePrintRequest } from '@/components/report-cards/print-root';
import { errorStatus } from '@/components/fees/money';
import { LoadError, PrintPortal } from '@/components/fees/shared';
import type { PlatformInvoiceDetail, PlatformReceipt } from '@/services/api/billing-service';
import { InvoiceDocument, ReceiptDocument, type BilledSchool } from './documents';

const INVOICE_PAGE = '@page { size: A4 portrait; margin: 12mm; }';
const RECEIPT_PAGE = '@page { size: A5 portrait; margin: 8mm; }';

interface Loaded<T> {
  data: T | undefined;
  error: unknown;
  isError: boolean;
  refetch: () => unknown;
}

function NotFound({ title, what, back }: { title: string; what: string; back: React.ReactNode }) {
  return (
    <PageShell title={title} eyebrow={back}>
      <EmptyState icon={FileSearch} title={`${title} not found`} description={`This ${what} doesn't exist or isn't yours to see.`} />
    </PageShell>
  );
}

export function InvoicePrintScreen({
  query,
  school,
  back,
}: {
  query: Loaded<PlatformInvoiceDetail>;
  /** Who was billed; null while it loads. */
  school: BilledSchool | null;
  back: React.ReactNode;
}) {
  const print = usePrintRequest();
  const invoice = query.data;

  if (query.isError) {
    if (errorStatus(query.error) === 404) return <NotFound title="Invoice" what="invoice" back={back} />;
    return (
      <PageShell title="Invoice" eyebrow={back}>
        <LoadError error={query.error} what="this invoice" onRetry={() => query.refetch()} />
      </PageShell>
    );
  }
  if (!invoice || !school) {
    return (
      <PageShell title="Invoice" eyebrow={back}>
        <Skeleton className="mx-auto h-[520px] w-full max-w-[210mm]" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Invoice ${invoice.number}`}
      eyebrow={back}
      primaryAction={
        <Button onClick={print}>
          <Printer aria-hidden="true" />
          Print invoice
        </Button>
      }
    >
      {invoice.status === 'void' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status="neutral" label="Void" />
          <span className="text-muted-foreground">Nothing is owed on this invoice. Reason: {invoice.void_reason || 'not given'}.</span>
        </div>
      ) : null}
      <div className="rounded-xl bg-muted/40 p-2 sm:p-6">
        <InvoiceDocument invoice={invoice} school={school} />
      </div>
      <PrintPortal pageCss={INVOICE_PAGE}>
        <InvoiceDocument invoice={invoice} school={school} className="max-w-none" />
      </PrintPortal>
    </PageShell>
  );
}

export function ReceiptPrintScreen({ query, back }: { query: Loaded<PlatformReceipt>; back: React.ReactNode }) {
  const print = usePrintRequest();
  const receipt = query.data;

  if (query.isError) {
    if (errorStatus(query.error) === 404) return <NotFound title="Receipt" what="receipt" back={back} />;
    return (
      <PageShell title="Receipt" eyebrow={back}>
        <LoadError error={query.error} what="this receipt" onRetry={() => query.refetch()} />
      </PageShell>
    );
  }
  if (!receipt) {
    return (
      <PageShell title="Receipt" eyebrow={back}>
        <Skeleton className="mx-auto h-[420px] w-full max-w-[148mm]" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Receipt ${receipt.receipt_number}`}
      eyebrow={back}
      primaryAction={
        <Button onClick={print}>
          <Printer aria-hidden="true" />
          Print receipt
        </Button>
      }
    >
      {receipt.voided ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status="danger" label="Void" />
          <span className="text-muted-foreground">This payment no longer counts. Reason: {receipt.void_reason || 'not given'}.</span>
        </div>
      ) : null}
      <div className="rounded-xl bg-muted/40 p-2 sm:p-6">
        <ReceiptDocument receipt={receipt} />
      </div>
      <PrintPortal pageCss={RECEIPT_PAGE}>
        <ReceiptDocument receipt={receipt} className="max-w-none" />
      </PrintPortal>
    </PageShell>
  );
}
