'use client';

// One payment receipt for a parent (GET /finance/family/payments/{id}), with Print. Prints on
// its own (A5), without the app around it.
import * as React from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, FileX, Printer } from 'lucide-react';

import { useFamilyReceipt, statusOf } from '@/components/parent/queries';
import { Receipt, ReceiptPrintRoot } from '@/components/parent/receipt';
import { RetryState } from '@/components/parent/states';
import { usePrintRequest } from '@/components/report-cards/print-root';
import { useReportCardSchool } from '@/components/results/results-view';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';

function ReceiptScreen() {
  const { tenantDomain, id } = useParams<{ tenantDomain: string; id: string }>();
  const child = useSearchParams().get('child') ?? '';
  const feesHref = `/${tenantDomain}/parent/fees${child ? `?child=${encodeURIComponent(child)}` : ''}`;
  const school = useReportCardSchool();
  const query = useFamilyReceipt(id);
  const print = usePrintRequest();
  const receipt = query.data;

  let content: React.ReactNode;
  if (query.isLoading) {
    content = <Skeleton className="mx-auto h-96 w-full max-w-md rounded-xl" aria-label="Loading receipt" />;
  } else if (query.isError) {
    const status = statusOf(query.error);
    content =
      status === 404 || status === 403 ? (
        <EmptyState
          icon={FileX}
          title="Receipt not found"
          description="This receipt is not available. Please ask the school office."
          action={
            <Button asChild variant="outline" className="min-h-11 text-base">
              <Link href={feesHref}>Back to fees</Link>
            </Button>
          }
        />
      ) : (
        <RetryState what="The receipt" onRetry={() => void query.refetch()} />
      );
  } else if (receipt) {
    content = (
      <>
        <Receipt receipt={receipt} school={school} />
        <ReceiptPrintRoot receipt={receipt} school={school} />
      </>
    );
  }

  return (
    <PageShell
      title="Receipt"
      description={receipt?.receipt_number ? `No. ${receipt.receipt_number}` : undefined}
      eyebrow={
        <Link
          href={feesHref}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to fees
        </Link>
      }
      primaryAction={
        receipt ? (
          <Button className="min-h-11 w-full text-base sm:w-auto" onClick={print}>
            <Printer aria-hidden="true" /> Print
          </Button>
        ) : undefined
      }
    >
      {content}
    </PageShell>
  );
}

export default function ParentReceiptPage() {
  return (
    <React.Suspense fallback={<Skeleton className="mx-auto mt-6 h-96 w-full max-w-md rounded-xl" />}>
      <ReceiptScreen />
    </React.Suspense>
  );
}
