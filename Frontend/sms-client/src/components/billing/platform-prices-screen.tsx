'use client';

// Platform → Billing → Price list (/platform/billing/prices): the price list in force and its
// history. One list for every school: per staff member a month, per parent or student a month
// they signed in, and a term minimum, each in USD and in LRD. A new list applies from its date to
// invoices issued from then on; lists are never edited, a new one replaces the old.
import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Tags } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageShell } from '@/components/ui/page-shell';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { errorMessage, formatDate } from '@/components/students/format';
import { formatMoney, todayIso } from '@/components/fees/money';
import { inputClassName, LoadError } from '@/components/fees/shared';
import type { PriceList, PriceListInput } from '@/services/api/billing-service';
import { useAddPriceList, usePaymentDetails, usePriceLists, useSetPaymentDetails } from './queries';

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;
const amount = z.string().trim().min(1, 'Enter an amount (0 for none)').regex(AMOUNT_RE, 'Enter an amount like 2 or 2.50');

const schema = z.object({
  effective_from: z.string().min(1, 'Choose the day the prices start'),
  staff_per_month_usd: amount,
  staff_per_month_lrd: amount,
  family_per_month_usd: amount,
  family_per_month_lrd: amount,
  term_minimum_usd: amount,
  term_minimum_lrd: amount,
});

type Values = z.infer<typeof schema>;

const ROWS: { key: 'staff_per_month' | 'family_per_month' | 'term_minimum'; label: string; hint: string }[] = [
  { key: 'staff_per_month', label: 'Staff, per month', hint: 'Each active staff account, for every billable month of the term.' },
  {
    key: 'family_per_month',
    label: 'Parent or student, per month',
    hint: 'Each parent or student account, for each month they signed in.',
  },
  { key: 'term_minimum', label: 'Term minimum', hint: 'A term invoice is topped up to this amount.' },
];

function Pair({ usd, lrd }: { usd: string; lrd: string }) {
  return (
    <span className="inline-flex flex-col tabular-nums">
      <span className="whitespace-nowrap">{formatMoney(usd, 'USD')}</span>
      <span className="whitespace-nowrap">{formatMoney(lrd, 'LRD')}</span>
    </span>
  );
}

function AddPriceSheet({ open, onOpenChange, current }: { open: boolean; onOpenChange: (open: boolean) => void; current?: PriceList }) {
  const formId = React.useId();
  const add = useAddPriceList();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  // Start from the prices in force, so a change touches only what changes
  React.useEffect(() => {
    if (!open) return;
    reset({
      effective_from: todayIso(),
      staff_per_month_usd: current?.staff_per_month_usd ?? '',
      staff_per_month_lrd: current?.staff_per_month_lrd ?? '',
      family_per_month_usd: current?.family_per_month_usd ?? '',
      family_per_month_lrd: current?.family_per_month_lrd ?? '',
      term_minimum_usd: current?.term_minimum_usd ?? '',
      term_minimum_lrd: current?.term_minimum_lrd ?? '',
    });
  }, [open, current, reset]);

  const onSubmit = handleSubmit(async (values: PriceListInput) => {
    try {
      const price = await add.mutateAsync(values);
      notify.success('Price list added', {
        description: price.in_force ? 'It applies to invoices issued from today.' : `It applies from ${formatDate(price.effective_from)}.`,
      });
      onOpenChange(false);
    } catch (e) {
      // A list on the same day (409) comes back as one plain line
      const msg = errorMessage(e, "Couldn't add the price list. Check the amounts and your connection, then try again.");
      setError('effective_from', { message: msg });
      notify.error(msg);
    }
  });

  const pending = add.isPending;
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title="New price list"
      description="It replaces the current list from its start date. Invoices already issued keep their prices."
      className="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Add price list
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-6">
        <FormField label="Starts on" error={errors.effective_from?.message} required>
          <Input type="date" className={inputClassName} {...register('effective_from')} />
        </FormField>
        {ROWS.map((row) => (
          <fieldset key={row.key} className="grid gap-3">
            <legend className="text-sm font-medium text-foreground">{row.label}</legend>
            <p className="-mt-1 text-sm text-muted-foreground">{row.hint}</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="USD" error={errors[`${row.key}_usd`]?.message} required>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  className={cn(inputClassName, 'tabular-nums')}
                  {...register(`${row.key}_usd`)}
                />
              </FormField>
              <FormField label="LRD" error={errors[`${row.key}_lrd`]?.message} required>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  className={cn(inputClassName, 'tabular-nums')}
                  {...register(`${row.key}_lrd`)}
                />
              </FormField>
            </div>
          </fieldset>
        ))}
      </form>
    </Sheet>
  );
}

const columns: ColumnDef<PriceList>[] = [
  {
    id: 'from',
    enableSorting: false,
    header: 'Starts on',
    cell: ({ row }) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap font-medium">{formatDate(row.original.effective_from)}</span>
        {row.original.in_force ? (
          <StatusBadge status="success" label="In force" />
        ) : row.original.effective_from > todayIso() ? (
          <StatusBadge status="info" label="Upcoming" />
        ) : null}
      </span>
    ),
  },
  {
    id: 'staff',
    enableSorting: false,
    header: 'Staff, per month',
    cell: ({ row }) => <Pair usd={row.original.staff_per_month_usd} lrd={row.original.staff_per_month_lrd} />,
    meta: { className: 'text-right' },
  },
  {
    id: 'family',
    enableSorting: false,
    header: 'Parent or student, per month',
    cell: ({ row }) => <Pair usd={row.original.family_per_month_usd} lrd={row.original.family_per_month_lrd} />,
    meta: { className: 'text-right' },
  },
  {
    id: 'minimum',
    enableSorting: false,
    header: 'Term minimum',
    cell: ({ row }) => <Pair usd={row.original.term_minimum_usd} lrd={row.original.term_minimum_lrd} />,
    meta: { className: 'text-right' },
  },
  {
    id: 'by',
    enableSorting: false,
    header: 'Added by',
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.created_by_name || '—'}
        {row.original.created_at ? <span className="block text-xs text-muted-foreground">{formatDate(row.original.created_at)}</span> : null}
      </span>
    ),
    meta: { hideOnMobile: true },
  },
];

// How schools pay (bank, mobile money): shown on each school admin's Billing page; while empty,
// schools are told to contact the platform administrator
function PaymentDetailsCard() {
  const q = usePaymentDetails();
  const save = useSetPaymentDetails();
  const [text, setText] = React.useState<string | null>(null);
  const saved = q.data?.instructions ?? '';
  const value = text ?? saved;
  const fieldId = React.useId();

  const handleSave = async () => {
    try {
      await save.mutateAsync(value);
      setText(null);
      notify.success(value.trim() ? 'Payment details saved. Schools see them on their Billing page.' : 'Payment details removed.');
    } catch (error) {
      notify.error(`${errorMessage(error, "The payment details weren't saved.")} Try again.`);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground" aria-labelledby="pay-details">
      <h2 id="pay-details" className="font-semibold">
        How schools pay
      </h2>
      <p className="text-sm text-muted-foreground">
        Bank account and mobile money numbers, as school admins should see them. While this is empty, schools are
        told to contact the platform administrator.
      </p>
      {q.isError ? (
        <LoadError error={q.error} what="the payment details" onRetry={() => q.refetch()} />
      ) : (
        <>
          <label htmlFor={fieldId} className="sr-only">
            Payment details
          </label>
          <Textarea
            id={fieldId}
            rows={5}
            maxLength={2000}
            value={value}
            disabled={q.isLoading}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Bank: name, account number, account name\nMobile money: number and name'}
          />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={q.isLoading || save.isPending || value === saved}>
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save payment details
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export function PlatformPricesScreen() {
  const q = usePriceLists();
  const prices = q.data ?? [];
  const current = prices.find((p) => p.in_force);
  const [adding, setAdding] = React.useState(false);

  return (
    <PageShell
      title="Price list"
      description="One price list for every school, in USD and in LRD. The list in force when an invoice is issued applies to it."
      primaryAction={
        <Button onClick={() => setAdding(true)} disabled={q.isLoading}>
          <Plus aria-hidden="true" />
          New price list
        </Button>
      }
    >
      {q.isError ? (
        <LoadError error={q.error} what="the price lists" onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground" aria-labelledby="price-current">
            <h2 id="price-current" className="font-semibold">
              In force today
            </h2>
            {current ? (
              <>
                <p className="text-sm text-muted-foreground">Since {formatDate(current.effective_from)}.</p>
                <dl className="grid gap-4 sm:grid-cols-3">
                  {ROWS.map((row) => (
                    <div key={row.key}>
                      <dt className="text-sm text-muted-foreground">{row.label}</dt>
                      <dd className="font-semibold">
                        <Pair usd={current[`${row.key}_usd`]} lrd={current[`${row.key}_lrd`]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-sm">
                No price list is in force yet, so no invoice can be issued. Add one that starts today or earlier.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="price-history">
            <h2 id="price-history" className="font-semibold">
              All price lists
            </h2>
            <DataTable
              columns={columns}
              data={prices}
              label="Price lists"
              pageSize={0}
              getRowId={(r) => r.id}
              emptyState={<EmptyState icon={Tags} title="No price lists yet" description="Add the first one to start billing schools." />}
            />
          </section>
        </>
      )}

      <PaymentDetailsCard />

      <AddPriceSheet open={adding} onOpenChange={setAdding} current={current} />
    </PageShell>
  );
}
