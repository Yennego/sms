'use client';

// The app shell's line about the school's platform account (phase7-design.md section 6): due soon,
// overdue, read-only, suspended or dormant. The server writes the line (`message`: with the amount
// for admins, a plain "Ask the school office" for others); admins also get a link to Billing.
// At a suspended school every other page is refused for admins too, so they are taken to Billing.
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Info, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BillingBanner as Banner } from '@/services/api/billing-service';
import { useBillingStatus } from './queries';

const STYLES: Record<Exclude<Banner, 'none'>, { className: string; icon: typeof Info }> = {
  due_soon: { className: 'border-blue-200 bg-blue-50 text-blue-900', icon: Info },
  overdue: { className: 'border-amber-200 bg-amber-50 text-amber-950', icon: AlertTriangle },
  read_only: { className: 'border-red-200 bg-red-50 text-red-900', icon: Lock },
  suspended: { className: 'border-red-200 bg-red-50 text-red-900', icon: Lock },
  dormant: { className: 'border-amber-200 bg-amber-50 text-amber-950', icon: Lock },
};

export function BillingBanner({ billingHref, onBillingPage }: { billingHref: string; onBillingPage?: boolean }) {
  const { data } = useBillingStatus();
  const router = useRouter();
  const sendToBilling = Boolean(data?.banner === 'suspended' && data.is_admin && !onBillingPage);
  React.useEffect(() => {
    if (sendToBilling) router.replace(billingHref);
  }, [sendToBilling, billingHref, router]);

  if (!data || data.banner === 'none' || !data.message) return null;
  const style = STYLES[data.banner] ?? STYLES.overdue;
  const Icon = style.icon;

  return (
    <div
      role={data.banner === 'due_soon' ? 'status' : 'alert'}
      className={cn('flex shrink-0 items-start gap-2 border-b px-4 py-2 text-sm sm:items-center', style.className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{data.message}</p>
      {data.is_admin && !onBillingPage ? (
        <Link
          href={billingHref}
          className="inline-flex min-h-11 shrink-0 items-center font-medium underline underline-offset-4 sm:min-h-0"
        >
          Open billing
        </Link>
      ) : null}
    </div>
  );
}
