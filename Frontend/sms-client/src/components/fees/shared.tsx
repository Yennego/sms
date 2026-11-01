'use client';

// Small building blocks shared by the Fees screens.
import * as React from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, ShieldAlert, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { errorMessage } from '@/components/students/format';
import { billingBlock } from '@/lib/billing-block';
import type { AccountState, Currency, PerCurrency } from '@/services/api/fees-service';
import { anyPositive, errorStatus, formatMoney, shownCurrencies } from './money';

/** Each currency on its own line ("USD 150.00" / "LRD 27,000.00"); never added together. */
export function Amounts({
  value,
  locked,
  className,
  strong,
}: {
  value: PerCurrency | null | undefined;
  locked?: Currency | null;
  className?: string;
  strong?: boolean;
}) {
  return (
    <span className={cn('inline-flex flex-col tabular-nums', strong && 'font-semibold', className)}>
      {shownCurrencies(value, locked).map((c) => (
        <span key={c} className="whitespace-nowrap">
          {formatMoney(value?.[c] ?? '0', c)}
        </span>
      ))}
    </span>
  );
}

/** A labelled figure on the overview and report pages. */
export function StatTile({
  label,
  icon: Icon,
  children,
  footer,
  tone = 'default',
}: {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tone?: 'default' | 'warning' | 'danger';
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 text-card-foreground',
        tone === 'warning' && 'border-amber-200',
        tone === 'danger' && 'border-red-200'
      )}
    >
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
        {label}
      </h2>
      <div className="text-xl font-semibold text-foreground md:text-2xl">{children}</div>
      {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
    </section>
  );
}

/** Owing / overdue / paid up, always with text. Uses the server's `status` when given. */
export function AccountStatusBadge({
  status,
  balance,
  overdue,
}: {
  status?: AccountState;
  balance?: PerCurrency | null;
  overdue?: PerCurrency | null;
}) {
  if (status === 'none') return <StatusBadge status="neutral" label="No bill yet" />;
  if (status === 'overdue' || anyPositive(overdue)) return <StatusBadge status="danger" label="Overdue" />;
  if (status === 'paid') return <StatusBadge status="success" label="Paid up" />;
  if (anyPositive(balance)) return <StatusBadge status="warning" label="Owing" />;
  return <StatusBadge status="success" label="Paid up" />;
}

/** Tab buttons that switch a view kept in the URL (not page links). */
export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  controls,
}: {
  tabs: { value: T; label: string; count?: number | null }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  controls?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          aria-controls={controls}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors',
            'focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50',
            value === t.value
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
          )}
        >
          {t.label}
          {typeof t.count === 'number' ? ` (${t.count.toLocaleString('en-US')})` : ''}
        </button>
      ))}
    </div>
  );
}

/** A failed load: plain words, the server's reason when it gave one, and "Try again". */
export function LoadError({ error, what, onRetry }: { error: unknown; what: string; onRetry?: () => void }) {
  // Refused by the school's billing status, not by the role: the server's line says why
  if (errorStatus(error) === 403 && billingBlock(error)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={`Can't open ${what} now`}
        description={errorMessage(error, "Your school's account is restricted. Ask the school office.")}
      />
    );
  }
  if (errorStatus(error) === 403) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Not available for your role"
        description={`Your role can't see ${what}. Ask the school's administrator if you need access.`}
      />
    );
  }
  return (
    <EmptyState
      icon={RefreshCw}
      title={`Couldn't load ${what}`}
      description={`${errorMessage(error, "The server didn't answer.")} Check your connection and try again.`}
      action={
        onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export const inputClassName = 'h-11 text-base md:h-9 md:text-sm';

export const nativeSelectClassName =
  'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:h-9 md:text-sm';

// ---- Printing ------------------------------------------------------------------------------------

const subscribe = () => () => {};

function useIsClient() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

/**
 * Prints `children` without the app around them: rendered into a portal under <body>, hidden on
 * screen; when printing every other child of <body> is hidden. `pageCss` sets the paper, e.g.
 * "@page { size: A5 portrait; margin: 8mm; }".
 */
export function PrintPortal({ pageCss, children }: { pageCss: string; children: React.ReactNode }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  const css = `
@media screen { .fees-print-root { display: none !important; } }
@media print {
  ${pageCss}
  html, body { background: #fff !important; }
  body > *:not(.fees-print-root) { display: none !important; }
  .fees-print-root { display: block !important; }
}`;
  return createPortal(
    <div className="fees-print-root" aria-hidden="true">
      <style>{css}</style>
      {children}
    </div>,
    document.body
  );
}
