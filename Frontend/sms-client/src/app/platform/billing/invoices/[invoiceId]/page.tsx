'use client';

// A platform invoice, printable (/platform/billing/invoices/{id}).
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { InvoicePrintScreen } from '@/components/billing/print-screens';
import { useBillingSchool, usePlatformInvoice } from '@/components/billing/queries';

export default function PlatformInvoicePage() {
  const params = useParams<{ invoiceId: string }>();
  const query = usePlatformInvoice(params?.invoiceId);
  // The invoice names its school only by id: its billing page gives the name and code
  const school = useBillingSchool(query.data?.tenant_id).data;

  return (
    <InvoicePrintScreen
      query={query}
      school={school ? { name: school.name, code: school.code } : null}
      back={
        <Link
          href={query.data ? `/platform/billing/schools/${query.data.tenant_id}` : '/platform/billing/invoices'}
          className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {school ? school.name : 'Invoices'}
        </Link>
      }
    />
  );
}
