'use client';

// A platform receipt, printable (/{school}/settings/billing/receipts/{payment id}; school admins).
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { ReceiptPrintScreen } from '@/components/billing/print-screens';
import { useSchoolReceipt } from '@/components/billing/queries';

export default function SchoolReceiptPage() {
  const params = useParams<{ tenantDomain: string; paymentId: string }>();
  const school = params?.tenantDomain ?? '';
  const query = useSchoolReceipt(params?.paymentId);

  return (
    <ReceiptPrintScreen
      query={query}
      back={
        <Link href={`/${school}/settings/billing`} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Billing
        </Link>
      }
    />
  );
}
