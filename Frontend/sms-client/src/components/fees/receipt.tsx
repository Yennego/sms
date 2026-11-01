// A payment receipt laid out like the paper receipt books schools use: school heading, receipt
// number and date, who paid, the amount in words and in figures with its currency, method,
// reference, who received it and the account's balance. Sized for A5 portrait.
// A voided receipt keeps its number and shows a large "VOID" watermark and the reason.
import * as React from 'react';

import { cn } from '@/lib/utils';
import type { Payment } from '@/services/api/fees-service';
import { formatDate } from '@/components/students/format';
import { amountInWords, formatDateTime, formatMoney, formatPair, methodLabel } from './money';

export interface ReceiptSchool {
  name: string;
  logo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  motto?: string | null;
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-baseline gap-2', className)}>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">{label}</span>
      <span className="min-w-0 flex-1 border-b border-dotted border-neutral-500 pb-0.5 font-medium break-words">
        {children || ' '}
      </span>
    </div>
  );
}

export function Receipt({ payment, school, className }: { payment: Payment; school: ReceiptSchool; className?: string }) {
  const voided = Boolean(payment.voided_at);
  const words = payment.amount_in_words || amountInWords(payment.amount, payment.currency);
  // balance_after is fixed when the payment is recorded, so a reprint shows the same figure.
  // Payments moved from the old app have none.
  const balance = payment.balance_after && Object.keys(payment.balance_after).length > 0 ? payment.balance_after : null;
  const contacts = [school.phone, school.email].filter(Boolean).join(' · ');

  return (
    <article
      aria-label={`Receipt ${payment.receipt_number}`}
      className={cn(
        'fees-receipt relative mx-auto w-full max-w-[148mm] overflow-hidden border-2 border-neutral-800 bg-white p-5 text-[13px] leading-snug text-neutral-900',
        'print:max-w-none print:border-neutral-800',
        className
      )}
    >
      {voided ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-30 select-none text-[96px] font-black tracking-widest text-red-600/25">VOID</span>
        </div>
      ) : null}

      {/* School heading */}
      <header className="flex items-center gap-3 border-b-2 border-neutral-800 pb-3">
        {school.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={school.logo} alt="" className="size-14 shrink-0 object-contain" />
        ) : null}
        <div className="min-w-0 flex-1 text-center">
          <p className="text-lg font-bold uppercase leading-tight">{school.name}</p>
          {school.motto ? <p className="text-xs italic text-neutral-700">{school.motto}</p> : null}
          {school.address ? <p className="text-xs text-neutral-700">{school.address}</p> : null}
          {contacts ? <p className="text-xs text-neutral-700">{contacts}</p> : null}
        </div>
        {school.logo ? <span className="size-14 shrink-0" aria-hidden="true" /> : null}
      </header>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-base font-bold uppercase tracking-wide">
          Official receipt{voided ? <span className="ml-2 text-red-700">(void)</span> : null}
        </h2>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Receipt no.</p>
          <p className="font-mono text-base font-bold text-red-800">{payment.receipt_number}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5">
        <Row label="Date">{formatDateTime(payment.received_at)}</Row>
        <Row label="Received from">{payment.student_name}</Row>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 print:grid-cols-2">
          <Row label="Admission no.">{payment.admission_number}</Row>
          <Row label="Class">{payment.class_name}</Row>
        </div>
        {payment.academic_year_name ? <Row label="School year">{payment.academic_year_name}</Row> : null}
        <Row label="The sum of">{words}</Row>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 print:grid-cols-2">
          <Row label="Method">{methodLabel(payment.method)}</Row>
          <Row label="Reference">{payment.reference}</Row>
        </div>
        {payment.note ? <Row label="Note">{payment.note}</Row> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-stretch justify-between gap-3">
        <div className="flex min-w-[45%] flex-col justify-center border-2 border-neutral-800 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Amount</span>
          <span className="text-xl font-bold tabular-nums">{formatMoney(payment.amount, payment.currency)}</span>
        </div>
        {balance ? (
          <div className="flex flex-col justify-center px-1 text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Balance after this payment</span>
            <span className="text-base font-semibold tabular-nums">{formatPair(balance)}</span>
          </div>
        ) : null}
      </div>

      {voided ? (
        <p className="mt-4 border border-red-700 px-3 py-2 text-red-800">
          <strong>Voided</strong> on {formatDate(payment.voided_at)}
          {payment.voided_by_name ? ` by ${payment.voided_by_name}` : ''}. Reason: {payment.void_reason || 'not given'}.
        </p>
      ) : null}

      <footer className="mt-6 flex items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="h-8 border-b border-neutral-700" />
          <p className="mt-1 text-xs text-neutral-700">
            Received by{payment.received_by_name ? `: ${payment.received_by_name}` : ''}
          </p>
        </div>
        <p className="max-w-[40%] text-right text-[11px] text-neutral-600">
          Keep this receipt as proof of payment.
        </p>
      </footer>
    </article>
  );
}
