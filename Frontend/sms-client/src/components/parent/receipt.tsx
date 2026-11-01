'use client';

// A payment receipt as families know it on paper: school, receipt number, date, child, amount
// with its currency code, method and who received it. Voided receipts keep their number and show
// VOID across them. <ReceiptPrintRoot> prints only the receipt (A5), without the app around it.
import * as React from 'react';
import { createPortal } from 'react-dom';

import { methodLabel, type FamilyReceipt } from '@/services/api/family-service';
import { cn } from '@/lib/utils';

import { formatDay, formatMoney, formatTime, moneyLines } from './money';

export interface ReceiptSchool {
  name: string;
  logo?: string | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-dashed border-slate-300 py-2 last:border-b-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="min-w-0 text-right text-base font-medium break-words text-slate-900">{value}</dd>
    </div>
  );
}

export function Receipt({ receipt, school, className }: { receipt: FamilyReceipt; school: ReceiptSchool; className?: string }) {
  const time = formatTime(receipt.received_at);
  const balance = moneyLines(receipt.balance_after, receipt.currency);
  return (
    <article
      className={cn('relative mx-auto w-full max-w-md overflow-hidden rounded-xl border bg-white p-5 text-slate-900', className)}
      aria-label={`Receipt ${receipt.receipt_number}`}
    >
      {receipt.voided ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-black tracking-widest text-red-600/20 [transform:rotate(-24deg)]"
        >
          VOID
        </div>
      ) : null}

      <header className="flex items-center gap-3 border-b pb-3">
        {school.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={school.logo} alt="" className="size-12 shrink-0 object-contain" />
        ) : null}
        <div className="min-w-0">
          {school.name ? <p className="truncate text-lg font-bold">{school.name}</p> : null}
          <p className="text-sm text-slate-600">Payment receipt</p>
        </div>
      </header>

      <div className="py-4 text-center">
        <p className="text-sm text-slate-600">Amount paid</p>
        <p className="text-3xl font-bold tabular-nums break-words">{formatMoney(receipt.amount, receipt.currency)}</p>
        {receipt.amount_in_words ? <p className="mt-1 text-sm text-slate-600">{receipt.amount_in_words}</p> : null}
        {receipt.voided ? (
          <p className="mt-2 text-sm font-semibold text-red-700">
            This receipt is VOID{receipt.void_reason ? `: ${receipt.void_reason}` : ''}.
          </p>
        ) : null}
      </div>

      <dl>
        <Row label="Receipt no." value={receipt.receipt_number || '—'} />
        <Row label="Date" value={`${formatDay(receipt.received_at, true)}${time ? `, ${time}` : ''}`} />
        <Row label="Student" value={receipt.student_name} />
        <Row label="Admission no." value={receipt.admission_number} />
        <Row label="Class" value={receipt.class_name} />
        <Row label="School year" value={receipt.academic_year_name} />
        <Row label="Paid by" value={methodLabel(receipt.method)} />
        <Row label="Reference" value={receipt.reference} />
        <Row label="Received by" value={receipt.received_by_name} />
        <Row label="Note" value={receipt.note} />
        {balance.length > 0 ? (
          <Row
            label="Balance after this payment"
            value={
              <span className="flex flex-col items-end">
                {balance.map((b) => (
                  <span key={b.currency} className="tabular-nums">
                    {b.text}
                  </span>
                ))}
              </span>
            }
          />
        ) : null}
      </dl>

      <p className="mt-4 text-center text-xs text-slate-500">Keep this receipt. Thank you.</p>
    </article>
  );
}

const PRINT_CSS = `
@media screen {
  .pf-receipt-print { display: none !important; }
}
@media print {
  @page { size: A5 portrait; margin: 8mm; }
  html, body { background: #fff !important; }
  body > *:not(.pf-receipt-print) { display: none !important; }
  .pf-receipt-print { display: block !important; }
  .pf-receipt-print article { border: none; max-width: none; }
}
`;

const subscribe = () => () => {};

export function ReceiptPrintRoot({ receipt, school }: { receipt: FamilyReceipt; school: ReceiptSchool }) {
  const isClient = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  if (!isClient) return null;
  return createPortal(
    <div className="pf-receipt-print" aria-hidden="true">
      <style>{PRINT_CSS}</style>
      <Receipt receipt={receipt} school={school} />
    </div>,
    document.body
  );
}
