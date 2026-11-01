'use client';

// A platform invoice, printable (/{school}/settings/billing/invoices/{id}; school admins).
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { InvoicePrintScreen } from '@/components/billing/print-screens';
import { useSchoolInvoice } from '@/components/billing/queries';
import { useTenant } from '@/hooks/use-tenant';

export default function SchoolInvoicePage() {
  const params = useParams<{ tenantDomain: string; invoiceId: string }>();
  const school = params?.tenantDomain ?? '';
  const query = useSchoolInvoice(params?.invoiceId);
  const { tenant } = useTenant();
  const billed = tenant?.name && tenant.name !== 'Loading...' ? { name: tenant.name, code: tenant.code } : null;

  return (
    <InvoicePrintScreen
      query={query}
      school={billed}
      back={
        <Link href={`/${school}/settings/billing`} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Billing
        </Link>
      }
    />
  );
}
