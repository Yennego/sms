'use client';

// Record payment (phase5-design.md section 6): find the student, see what they owe, enter the
// amount, currency and method, then open the printable receipt.
//
// The currency is fixed once the student's first payment of the year is in ("This student pays
// in LRD this year"). The amount may not exceed the balance in that currency; the server checks
// again and its message ("Balance is USD 120.00") is shown as given.
//
//   <RecordPaymentSheet school={school} open={open} onOpenChange={setOpen} student={{ student_id, name }} />
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { errorMessage } from '@/components/students/format';
import { useDebounce } from '@/hooks/use-debounce';
import {
  CURRENCIES,
  PAYMENT_METHODS,
  type Currency,
  type PaymentMethod,
} from '@/services/api/fees-service';
import { anyPositive, errorStatus, exceeds, formatMoney, formatPair, isPositive, METHOD_LABELS } from './money';
import { useAccounts, useRecordPayment, useStatement } from './queries';
import { Amounts, inputClassName } from './shared';

export interface PaymentStudent {
  student_id: string;
  name: string;
  class_name?: string | null;
  admission_number?: string | null;
}

export interface RecordPaymentSheetProps {
  school: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start with this student (from a statement or a list row). Otherwise the sheet asks. */
  student?: PaymentStudent | null;
  /** School year of the account; the current year when omitted. */
  yearId?: string;
}

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;

const schema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Enter the amount received')
    .regex(AMOUNT_RE, 'Enter an amount like 150 or 150.50')
    .refine((v) => isPositive(v), 'Enter an amount above zero'),
  currency: z.enum(CURRENCIES),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(100, 'Keep the reference under 100 characters'),
  note: z.string().trim().max(500, 'Keep the note under 500 characters'),
});

type Values = z.infer<typeof schema>;

const DEFAULTS: Values = { amount: '', currency: 'USD', method: 'cash', reference: '', note: '' };

const REFERENCE_HINT: Record<PaymentMethod, string> = {
  cash: 'Optional, e.g. a paper receipt book number.',
  bank: 'The bank slip or deposit number.',
  mobile_money: 'The mobile money transaction ID.',
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

function StudentFinder({ yearId, onPick }: { yearId?: string; onPick: (s: PaymentStudent) => void }) {
  const [text, setText] = React.useState('');
  const q = useDebounce(text.trim(), 300);
  const searchId = React.useId();
  const results = useAccounts({ academicYearId: yearId, status: 'all', q, sort: 'name', page: 1, pageSize: 8 }, q.length >= 2);
  const items = results.data?.items ?? [];

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <label htmlFor={searchId} className="text-sm font-medium text-foreground">
          Find the student
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            autoFocus
            autoComplete="off"
            value={text}
            maxLength={100}
            onChange={(e) => setText(e.target.value)}
            placeholder="Name or admission no."
            aria-describedby={`${searchId}-hint`}
            className={cn(inputClassName, 'pl-9')}
          />
        </div>
        <p id={`${searchId}-hint`} className="text-sm text-muted-foreground">
          Type at least two letters of the name or the admission number.
        </p>
      </div>

      {q.length >= 2 ? (
        results.isLoading ? (
          <div className="grid gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : results.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(results.error, "Couldn't search students. Check your connection and try again.")}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No student with a fee account matches “{q}”. Check the spelling, or issue invoices for their class in Fee
            setup first.
          </p>
        ) : (
          <ul className="grid gap-2" aria-label="Matching students" aria-busy={results.isFetching || undefined}>
            {items.map((s) => (
              <li key={s.student_id}>
                <button
                  type="button"
                  onClick={() =>
                    onPick({
                      student_id: s.student_id,
                      name: s.name,
                      class_name: s.class_name,
                      admission_number: s.admission_number,
                    })
                  }
                  className="flex min-h-11 w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{s.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[s.class_name, s.admission_number].filter(Boolean).join(' · ') || 'No class'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block text-muted-foreground">Balance</span>
                    <Amounts value={s.balance} locked={s.currency} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function RecordPaymentSheet({ school, open, onOpenChange, student, yearId }: RecordPaymentSheetProps) {
  const router = useRouter();
  const formId = React.useId();
  const [picked, setPicked] = React.useState<PaymentStudent | null>(null);
  const current = student ?? picked;
  const record = useRecordPayment();

  const statementQ = useStatement(open ? current?.student_id : undefined, yearId);
  const statement = statementQ.data;
  const locked = statement?.account.currency ?? null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  // Fresh form each time the sheet opens.
  React.useEffect(() => {
    if (open) {
      reset(DEFAULTS);
      setPicked(null);
    }
  }, [open, reset]);

  // The currencies this student can pay in: the fixed one, else those the bill is priced in.
  const payable = React.useMemo<Currency[]>(
    () => (locked ? [locked] : statement?.currencies.length ? statement.currencies : [...CURRENCIES]),
    [locked, statement]
  );
  const currency = watch('currency');

  // The student's currency is fixed for the year once locked; a bill priced only in LRD starts on LRD.
  React.useEffect(() => {
    if (!payable.includes(currency)) setValue('currency', payable[0]);
  }, [payable, currency, setValue]);

  const method = watch('method');
  const balance = statement?.balance;
  const owesInCurrency = isPositive(balance?.[currency]);
  const owesAnything = anyPositive(balance);
  const noAccount = statementQ.isError && errorStatus(statementQ.error) === 404;

  const onSubmit = handleSubmit(async (values) => {
    if (!current || !statement) return;
    if (exceeds(values.amount, balance?.[values.currency])) {
      setError('amount', {
        message: `Balance is ${formatMoney(balance?.[values.currency] ?? '0', values.currency)}. Enter that amount or less.`,
      });
      return;
    }
    try {
      const payment = await record.mutateAsync({
        student_id: current.student_id,
        academic_year_id: statement.account.academic_year_id,
        amount: values.amount,
        currency: values.currency,
        method: values.method,
        reference: values.reference || null,
        note: values.note || null,
      });
      notify.success(`Payment recorded: receipt ${payment.receipt_number}`, {
        description: `${formatMoney(payment.amount, payment.currency)} from ${current.name}`,
      });
      onOpenChange(false);
      router.push(`/${school}/finance/payments/${payment.id}`);
    } catch (error) {
      const status = errorStatus(error);
      notify.error(
        status === 403
          ? "Your role can't record payments. Ask the principal or administrator."
          : errorMessage(error, "Couldn't record the payment. Check the details and your connection, then try again.")
      );
    }
  });

  const pending = record.isPending;
  const canSubmit = Boolean(current && statement && owesAnything && owesInCurrency && !pending);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title="Record payment"
      description={current ? [current.name, current.class_name].filter(Boolean).join(' · ') : 'Money received from a family.'}
      className="sm:max-w-md"
      footer={
        current ? (
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={!canSubmit}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Record payment and open receipt
            </Button>
          </>
        ) : undefined
      }
    >
      {!current ? (
        <StudentFinder yearId={yearId} onPick={setPicked} />
      ) : (
        <div className="grid gap-5">
          {!student ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-fit justify-start px-2 md:min-h-9"
              onClick={() => setPicked(null)}
              disabled={pending}
            >
              <ArrowLeft aria-hidden="true" />
              Choose another student
            </Button>
          ) : null}

          {/* What they owe */}
          <section aria-label="Balance" className="rounded-lg border bg-muted/40 p-3">
            {statementQ.isLoading ? (
              <div className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-40" />
              </div>
            ) : noAccount ? (
              <p className="text-sm text-foreground">
                {current.name} has no bill this school year yet. Issue invoices for their class in Fee setup, then
                record the payment.
              </p>
            ) : statementQ.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(statementQ.error, "Couldn't load this student's balance. Check your connection and try again.")}
              </p>
            ) : statement ? (
              <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">Balance</p>
                <Amounts value={statement.balance} locked={locked} strong className="text-lg" />
                {anyPositive(statement.overdue) ? (
                  <p className="text-sm text-red-700">Overdue: {formatPair(statement.overdue, locked)}</p>
                ) : null}
                {!owesAnything ? <p className="text-sm text-foreground">Nothing is owed. This account is paid up.</p> : null}
              </div>
            ) : null}
          </section>

          {statement && owesAnything ? (
            <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-5">
              <ChoiceButtons<Currency>
                legend="Currency"
                options={payable.map((c) => ({ value: c, label: c }))}
                value={currency}
                onChange={(v) => setValue('currency', v, { shouldValidate: true })}
                disabled={Boolean(locked) || pending}
                description={
                  locked
                    ? `This student pays in ${locked} this year.`
                    : 'The first payment fixes the currency for the rest of the school year.'
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

              <ChoiceButtons<PaymentMethod>
                legend="Method"
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
                value={method}
                onChange={(v) => setValue('method', v, { shouldValidate: true })}
                disabled={pending}
              />

              <FormField label="Reference" error={errors.reference?.message} description={REFERENCE_HINT[method]}>
                <Input autoComplete="off" className={inputClassName} {...register('reference')} />
              </FormField>

              <FormField label="Note" error={errors.note?.message} description="Printed on the receipt.">
                <Textarea rows={2} {...register('note')} />
              </FormField>
            </form>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
