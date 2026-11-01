'use client';

// A platform receipt, printable (/platform/billing/receipts/{payment id}).
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { ReceiptPrintScreen } from '@/components/billing/print-screens';
import { usePlatformReceipt } from '@/components/billing/queries';

export default function PlatformReceiptPage() {
  const params = useParams<{ paymentId: string }>();
  const query = usePlatformReceipt(params?.paymentId);
  const school = query.data?.school;

  return (
    <ReceiptPrintScreen
      query={query}
      back={
        <Link
          href={school ? `/platform/billing/schools/${school.id}` : '/platform/billing'}
          className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {school ? school.name : 'Billing'}
        </Link>
      }
    />
  );
}
