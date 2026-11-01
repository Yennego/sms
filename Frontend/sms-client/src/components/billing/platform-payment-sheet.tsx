'use client';

// Record a school's payment against a platform invoice (bank, mobile money or cash), then offer
// its receipt. The invoice's first payment fixes its currency ("This invoice is being paid in
// USD"); the amount may not exceed the balance in that currency. The server checks both again and
// its message ("Balance is USD 20.00") is shown as given.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { notify } from '@/components/ui/toaster';
import { errorMessage } from '@/components/students/format';
import { exceeds, formatMoney, isPositive, todayIso, METHOD_LABELS } from '@/components/fees/money';
import { Amounts, inputClassName } from '@/components/fees/shared';
import { CURRENCIES, type Currency } from '@/services/api/fees-service';
import {
  PLATFORM_PAYMENT_METHODS,
  type PlatformInvoice,
  type PlatformPaymentMethod,
} from '@/services/api/billing-service';
import { useRecordPlatformPayment } from './queries';

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;

const schema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Enter the amount received')
    .regex(AMOUNT_RE, 'Enter an amount like 150 or 150.50')
    .refine((v) => isPositive(v), 'Enter an amount above zero'),
  currency: z.enum(CURRENCIES),
  method: z.enum(PLATFORM_PAYMENT_METHODS),
  reference: z.string().trim().max(100, 'Keep the reference under 100 characters'),
  received_on: z
    .string()
    .min(1, 'Enter the day the money arrived')
    .refine((v) => v <= todayIso(), "The day can't be in the future"),
});

type Values = z.infer<typeof schema>;

const REFERENCE_HINT: Record<PlatformPaymentMethod, string> = {
  bank: 'The bank slip or transfer number.',
  mobile_money: 'The mobile money transaction ID.',
  cash: 'Optional, e.g. a paper receipt number.',
};

function ChoiceButtons<T extends string>({
  legend,
  options,
  value,
  onChange,
  disabled,
  description,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  description?: React.ReactNode;
}) {
  const name = React.useId();
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 md:min-h-9',
              value === o.value ? 'border-primary bg-primary/5 text-foreground' : 'text-muted-foreground hover:bg-accent',
              disabled && 'cursor-not-allowed opacity-70'
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="size-4 accent-primary"
            />
            {o.label}
          </label>
        ))}
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </fieldset>
  );
}

export function PlatformPaymentSheet({
  invoice,
  schoolName,
  onOpenChange,
}: {
  /** The invoice being paid; null closes the sheet. */
  invoice: PlatformInvoice | null;
  schoolName?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formId = React.useId();
  const record = useRecordPlatformPayment();
  const locked = invoice?.currency ?? null;
  const payable: Currency[] = locked ? [locked] : [...CURRENCIES];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', currency: 'USD', method: 'bank', reference: '', received_on: todayIso() },
  });

  // Fresh form for each invoice, on its currency when it is fixed
  React.useEffect(() => {
    if (invoice) {
      reset({ amount: '', currency: invoice.currency ?? 'USD', method: 'bank', reference: '', received_on: todayIso() });
    }
  }, [invoice, reset]);

  const currency = watch('currency');
  const method = watch('method');
  const balance = invoice?.balance;

  const onSubmit = handleSubmit(async (values) => {
    if (!invoice) return;
    if (exceeds(values.amount, balance?.[values.currency])) {
      setError('amount', {
        message: `Balance is ${formatMoney(balance?.[values.currency] ?? '0', values.currency)}. Enter that amount or less.`,
      });
      return;
    }
    try {
      const receipt = await record.mutateAsync({
        invoiceId: invoice.id,
        input: {
          amount: values.amount,
          currency: values.currency,
          method: values.method,
          reference: values.reference || null,
          // Today: the server's clock. An earlier day: noon UTC that day.
          received_at: values.received_on === todayIso() ? null : `${values.received_on}T12:00:00Z`,
        },
      });
      notify.success(`Payment recorded: receipt ${receipt.receipt_number}`, {
        description: `${formatMoney(receipt.amount, receipt.currency)} from ${receipt.school?.name ?? schoolName ?? 'the school'}`,
        action: { label: 'Open receipt', onClick: () => router.push(`/platform/billing/receipts/${receipt.id}`) },
      });
      onOpenChange(false);
    } catch (error) {
      // Overpaying or the wrong currency (409) come back as one plain line
      const msg = errorMessage(error, "Couldn't record the payment. Check the details and your connection, then try again.");
      setError('amount', { message: msg });
      notify.error(msg);
    }
  });

  const pending = record.isPending;
  const owesInCurrency = isPositive(balance?.[currency]);

  return (
    <Sheet
      open={Boolean(invoice)}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title="Record payment"
      description={invoice ? [schoolName, `Invoice ${invoice.number}`].filter(Boolean).join(' · ') : undefined}
      className="sm:max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending || !owesInCurrency}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Record payment
          </Button>
        </>
      }
    >
      {invoice ? (
        <div className="grid gap-5">
          <section aria-label="Balance" className="grid gap-1 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm text-muted-foreground">Balance</p>
            <Amounts value={invoice.balance} locked={locked} strong className="text-lg" />
            {!locked ? <p className="text-sm text-muted-foreground">Either amount pays the invoice, not both.</p> : null}
          </section>

          <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-5">
            <ChoiceButtons<Currency>
              legend="Currency"
              options={payable.map((c) => ({ value: c, label: c }))}
              value={currency}
              onChange={(v) => setValue('currency', v, { shouldValidate: true })}
              disabled={Boolean(locked) || pending}
              description={
                locked
                  ? `This invoice is being paid in ${locked}.`
                  : 'The first payment fixes the currency for the rest of this invoice.'
              }
            />

            <FormField
              label={`Amount (${currency})`}
              error={errors.amount?.message}
              required
              description={
                owesInCurrency
                  ? `Balance in ${currency}: ${formatMoney(balance?.[currency] ?? '0', currency)}`
                  : `Nothing is owed in ${currency}.`
              }
            >
              <Input
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className={cn(inputClassName, 'tabular-nums')}
                {...register('amount')}
              />
            </FormField>

            <ChoiceButtons<PlatformPaymentMethod>
              legend="Method"
              options={PLATFORM_PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
              value={method}
              onChange={(v) => setValue('method', v, { shouldValidate: true })}
              disabled={pending}
            />

            <FormField label="Reference" error={errors.reference?.message} description={REFERENCE_HINT[method]}>
              <Input autoComplete="off" className={inputClassName} {...register('reference')} />
            </FormField>

            <FormField label="Received on" error={errors.received_on?.message} required>
              <Input type="date" max={todayIso()} className={inputClassName} {...register('received_on')} />
            </FormField>
          </form>
        </div>
      ) : null}
    </Sheet>
  );
}
