// The printed platform invoice (A4) and receipt (A5), laid out like the Fees receipt
// (components/fees/receipt.tsx): the platform's heading, the number and date, the school billed,
// the figures with their currency, and a large "VOID" watermark when voided.
import * as React from 'react';

import { cn } from '@/lib/utils';
import { formatDate } from '@/components/students/format';
import { amountInWords, formatAmount, formatDateTime, formatMoney, formatPair } from '@/components/fees/money';
import type { PlatformInvoiceDetail, PlatformReceipt } from '@/services/api/billing-service';
import { methodLabel, PLATFORM_NAME } from './format';

export interface BilledSchool {
  name: string;
  code?: string | null;
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

function Watermark() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="-rotate-30 select-none text-[96px] font-black tracking-widest text-red-600/25">VOID</span>
    </div>
  );
}

function Heading({ title, numberLabel, number, voided }: { title: string; numberLabel: string; number: string; voided: boolean }) {
  return (
    <>
      <header className="border-b-2 border-neutral-800 pb-3 text-center">
        <p className="text-lg font-bold uppercase leading-tight">{PLATFORM_NAME}</p>
        <p className="text-xs text-neutral-700">School management platform</p>
      </header>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-base font-bold uppercase tracking-wide">
          {title}
          {voided ? <span className="ml-2 text-red-700">(void)</span> : null}
        </h2>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">{numberLabel}</p>
          <p className="font-mono text-base font-bold text-red-800">{number}</p>
        </div>
      </div>
    </>
  );
}

export function InvoiceDocument({
  invoice,
  school,
  className,
}: {
  invoice: PlatformInvoiceDetail;
  school: BilledSchool;
  className?: string;
}) {
  const voided = invoice.status === 'void';
  const live = invoice.payments.filter((p) => !p.voided);
  return (
    <article
      aria-label={`Invoice ${invoice.number}`}
      className={cn(
        'relative mx-auto w-full max-w-[210mm] overflow-hidden border-2 border-neutral-800 bg-white p-5 text-[13px] leading-snug text-neutral-900',
        'print:max-w-none',
        className
      )}
    >
      {voided ? <Watermark /> : null}
      <Heading title="Invoice" numberLabel="Invoice no." number={invoice.number} voided={voided} />

      <div className="mt-3 grid gap-2.5">
        <Row label="Billed to">
          {school.name}
          {school.code ? ` (${school.code})` : ''}
        </Row>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 print:grid-cols-2">
          <Row label="Issued">{formatDate(invoice.issued_at)}</Row>
          <Row label="Due">{formatDate(invoice.due_date)}</Row>
        </div>
        <Row label="Period">
          {invoice.semester_name ? `${invoice.semester_name}: ` : ''}
          {formatDate(invoice.period_start)} to {formatDate(invoice.period_end)}
        </Row>
      </div>

      <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y-2 border-neutral-800 text-left">
            <th scope="col" className="py-1.5 pr-2">Item</th>
            <th scope="col" className="hidden sm:table-cell print:table-cell py-1.5 pr-2 text-right">Qty</th>
            <th scope="col" className="hidden sm:table-cell print:table-cell py-1.5 pr-2 text-right">Unit USD</th>
            <th scope="col" className="hidden sm:table-cell print:table-cell py-1.5 pr-2 text-right">Unit LRD</th>
            <th scope="col" className="py-1.5 pr-2 text-right">USD</th>
            <th scope="col" className="py-1.5 text-right">LRD</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id} className="border-b border-neutral-300 align-top">
              <td className="py-1.5 pr-2">{l.description}</td>
              <td className="hidden sm:table-cell print:table-cell py-1.5 pr-2 text-right tabular-nums">{String(l.quantity)}</td>
              <td className="hidden sm:table-cell print:table-cell py-1.5 pr-2 text-right tabular-nums">{formatAmount(l.unit_usd)}</td>
              <td className="hidden sm:table-cell print:table-cell py-1.5 pr-2 text-right tabular-nums">{formatAmount(l.unit_lrd)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatAmount(l.amount_usd)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatAmount(l.amount_lrd)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-800 font-bold">
            <th scope="row" className="py-1.5 pr-2 text-left">
              Total
            </th>
            <td colSpan={3} className="hidden sm:table-cell print:table-cell" />
            <td className="py-1.5 pr-2 text-right tabular-nums">{formatAmount(invoice.total.USD)}</td>
            <td className="py-1.5 text-right tabular-nums">{formatAmount(invoice.total.LRD)}</td>
          </tr>
        </tfoot>
      </table>
      </div>

      <p className="mt-2 text-[11px] text-neutral-700">
        {invoice.currency
          ? `This invoice is being paid in ${invoice.currency}.`
          : 'Pay the USD total or the LRD total, not both. The first payment fixes the currency.'}
      </p>

      {live.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Payments received</p>
          <ul className="mt-1 grid gap-0.5">
            {live.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  {p.receipt_number} · {formatDate(p.received_at)} · {methodLabel(p.method)}
                </span>
                <span className="tabular-nums">{formatMoney(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!voided ? (
        <div className="mt-4 flex justify-end">
          <div className="flex min-w-[45%] flex-col border-2 border-neutral-800 px-3 py-2 text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Balance due</span>
            <span className="text-lg font-bold tabular-nums">{formatPair(invoice.balance, invoice.currency)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-4 border border-red-700 px-3 py-2 text-red-800">
          <strong>Voided</strong> on {formatDate(invoice.voided_at)}. Reason: {invoice.void_reason || 'not given'}.
        </p>
      )}
    </article>
  );
}

export function ReceiptDocument({ receipt, className }: { receipt: PlatformReceipt; className?: string }) {
  const voided = receipt.voided;
  const words = receipt.amount_in_words || amountInWords(receipt.amount, receipt.currency);
  const balance = receipt.balance_now && Object.keys(receipt.balance_now).length > 0 ? receipt.balance_now : null;
  return (
    <article
      aria-label={`Receipt ${receipt.receipt_number}`}
      className={cn(
        'relative mx-auto w-full max-w-[148mm] overflow-hidden border-2 border-neutral-800 bg-white p-5 text-[13px] leading-snug text-neutral-900',
        'print:max-w-none',
        className
      )}
    >
      {voided ? <Watermark /> : null}
      <Heading title="Official receipt" numberLabel="Receipt no." number={receipt.receipt_number} voided={voided} />

      <div className="mt-3 grid gap-2.5">
        <Row label="Date">{formatDateTime(receipt.received_at)}</Row>
        <Row label="Received from">
          {receipt.school.name}
          {receipt.school.code ? ` (${receipt.school.code})` : ''}
        </Row>
        <Row label="For invoice">{receipt.invoice_number}</Row>
        <Row label="The sum of">{words}</Row>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 print:grid-cols-2">
          <Row label="Method">{methodLabel(receipt.method)}</Row>
          <Row label="Reference">{receipt.reference || receipt.provider_ref}</Row>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-stretch justify-between gap-3">
        <div className="flex min-w-[45%] flex-col justify-center border-2 border-neutral-800 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Amount</span>
          <span className="text-xl font-bold tabular-nums">{formatMoney(receipt.amount, receipt.currency)}</span>
        </div>
        <div className="flex flex-col justify-center px-1 text-right">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Invoice total</span>
          <span className="tabular-nums">{formatMoney(receipt.invoice_total, receipt.currency)}</span>
          {balance ? (
            <>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Balance now</span>
              <span className="font-semibold tabular-nums">{formatPair(balance)}</span>
            </>
          ) : null}
        </div>
      </div>

      {voided ? (
        <p className="mt-4 border border-red-700 px-3 py-2 text-red-800">
          <strong>Voided</strong> on {formatDate(receipt.voided_at)}
          {receipt.voided_by_name ? ` by ${receipt.voided_by_name}` : ''}. Reason: {receipt.void_reason || 'not given'}.
        </p>
      ) : null}

      <footer className="mt-6 flex items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="h-8 border-b border-neutral-700" />
          <p className="mt-1 text-xs text-neutral-700">
            Received by{receipt.recorded_by_name ? `: ${receipt.recorded_by_name}` : ''}
          </p>
        </div>
        <p className="max-w-[40%] text-right text-[11px] text-neutral-600">Keep this receipt as proof of payment.</p>
      </footer>
    </article>
  );
}
