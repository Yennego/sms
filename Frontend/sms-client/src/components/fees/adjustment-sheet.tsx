'use client';

// "Add discount or scholarship": a discount, scholarship or waiver on one invoice, as a percent
// or a fixed amount per currency, with a reason. Needs approve_financial_transactions.
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { errorMessage } from '@/components/students/format';
import type { AdjustmentKind, Currency, Invoice } from '@/services/api/fees-service';
import { ADJUSTMENT_LABELS, exceeds, isPositive } from './money';
import { useAddAdjustment } from './queries';
import { inputClassName, nativeSelectClassName } from './shared';

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;
const optionalAmount = z
  .string()
  .trim()
  .refine((v) => v === '' || AMOUNT_RE.test(v), 'Enter an amount like 50 or 50.25');

const schema = z
  .object({
    invoice_id: z.string().min(1, 'Choose the semester bill'),
    kind: z.enum(['discount', 'scholarship', 'waiver']),
    by: z.enum(['percent', 'amount']),
    percent: z.string().trim(),
    amount_usd: optionalAmount,
    amount_lrd: optionalAmount,
    reason: z.string().trim().min(3, 'Say why, e.g. "Sibling discount"').max(500, 'Keep the reason under 500 characters'),
  })
  .superRefine((v, ctx) => {
    if (v.by === 'percent') {
      if (!AMOUNT_RE.test(v.percent) || !isPositive(v.percent) || exceeds(v.percent, '100')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['percent'], message: 'Enter a percent from 0.01 to 100' });
      }
    } else if (!isPositive(v.amount_usd) && !isPositive(v.amount_lrd)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount_usd'], message: 'Enter an amount in at least one currency' });
    }
  });

type Values = z.infer<typeof schema>;

export function AdjustmentSheet({
  open,
  onOpenChange,
  invoices,
  locked,
  currencies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
  locked: Currency | null;
  /** Currencies the bill is priced in; a fixed amount must be given in each until one is fixed. */
  currencies: Currency[];
}) {
  const formId = React.useId();
  const add = useAddAdjustment();
  const issued = invoices.filter((i) => i.status !== 'void');
  const onlyInvoice = issued.length === 1 ? issued[0].id : '';
  const defaults = React.useMemo<Values>(
    () => ({
      invoice_id: onlyInvoice,
      kind: 'discount',
      by: 'percent',
      percent: '',
      amount_usd: '',
      amount_lrd: '',
      reason: '',
    }),
    [onlyInvoice]
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  React.useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const by = watch('by');
  const priced = currencies.length > 0 ? currencies : (['USD', 'LRD'] as Currency[]);
  const showUsd = locked ? locked === 'USD' : priced.includes('USD');
  const showLrd = locked ? locked === 'LRD' : priced.includes('LRD');

  const onSubmit = handleSubmit(async (v) => {
    try {
      await add.mutateAsync({
        invoiceId: v.invoice_id,
        input: {
          kind: v.kind as AdjustmentKind,
          reason: v.reason,
          percent: v.by === 'percent' ? v.percent : null,
          amount_usd: v.by === 'amount' && showUsd && v.amount_usd ? v.amount_usd : null,
          amount_lrd: v.by === 'amount' && showLrd && v.amount_lrd ? v.amount_lrd : null,
        },
      });
      notify.success(`${ADJUSTMENT_LABELS[v.kind as AdjustmentKind]} added`, { description: 'The balance has been updated.' });
      onOpenChange(false);
    } catch (error) {
      notify.error(errorMessage(error, "Couldn't add this. Check the details and try again."));
    }
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !add.isPending && onOpenChange(next)}
      title="Add discount or scholarship"
      description="Lowers what this student owes on one semester bill."
      className="sm:max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Add to the bill
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-5">
        <FormField label="Semester bill" error={errors.invoice_id?.message} required>
          <select className={nativeSelectClassName} {...register('invoice_id')}>
            <option value="">Choose a bill</option>
            {issued.map((i) => (
              <option key={i.id} value={i.id}>
                {i.semester_name || 'Semester bill'}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Kind" error={errors.kind?.message} required>
          <select className={nativeSelectClassName} {...register('kind')}>
            {(Object.keys(ADJUSTMENT_LABELS) as AdjustmentKind[]).map((k) => (
              <option key={k} value={k}>
                {ADJUSTMENT_LABELS[k]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="How much" required>
          <select className={nativeSelectClassName} {...register('by')}>
            <option value="percent">A percent of the bill</option>
            <option value="amount">A fixed amount</option>
          </select>
        </FormField>

        {by === 'percent' ? (
          <FormField label="Percent" error={errors.percent?.message} required description="100 removes the whole bill.">
            <Input inputMode="decimal" placeholder="e.g. 25" className={inputClassName} {...register('percent')} />
          </FormField>
        ) : (
          <>
            {showUsd ? (
              <FormField label="Amount in USD" error={errors.amount_usd?.message}>
                <Input inputMode="decimal" placeholder="0.00" className={inputClassName} {...register('amount_usd')} />
              </FormField>
            ) : null}
            {showLrd ? (
              <FormField label="Amount in LRD" error={showUsd ? errors.amount_lrd?.message : errors.amount_usd?.message ?? errors.amount_lrd?.message}>
                <Input inputMode="decimal" placeholder="0.00" className={inputClassName} {...register('amount_lrd')} />
              </FormField>
            ) : null}
            {!locked && showUsd && showLrd ? (
              <p className="text-sm text-muted-foreground">
                The student&apos;s currency isn&apos;t fixed yet, so give the amount in both currencies.
              </p>
            ) : null}
          </>
        )}

        <FormField label="Reason" error={errors.reason?.message} required>
          <Textarea rows={2} placeholder="e.g. Sibling discount" {...register('reason')} />
        </FormField>
      </form>
    </Sheet>
  );
}
