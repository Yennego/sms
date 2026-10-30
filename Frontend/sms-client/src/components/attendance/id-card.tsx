'use client';

// A student's QR ID card at ID-1 (CR80) size: 85.6 x 54 mm. Shared by the class ID cards page
// (/attendance/id-cards) and the student profile's ID card tab.
//
//   <IdCardStyles />                       // card size rules (once per page)
//   <IdCardView card={card} schoolName={tenant?.name} />
//
// Printing one card without the app around it (the profile tab):
//   const { printing, print } = useIdCardPrint();
//   <Button onClick={print}>Print card</Button>
//   {printing ? <IdCardPrintRoot cards={[card]} schoolName={...} /> : null}
//
// The QR (qr_svg) is server-generated SVG of a signed token, the thing the gate scanner reads.
import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';
import type { IdCard } from '@/types/daily-attendance';

/** Card size rules (screen and print). */
export const ID_CARD_CSS = `
.id-card { width: 85.6mm; height: 54mm; break-inside: avoid; page-break-inside: avoid; }
.id-card-qr svg { width: 100%; height: 100%; }
`;

export function IdCardStyles() {
  return <style>{ID_CARD_CSS}</style>;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export interface IdCardViewProps {
  card: IdCard;
  schoolName?: string | null;
  className?: string;
}

export function IdCardView({ card, schoolName, className }: IdCardViewProps) {
  return (
    <div
      data-slot="id-card"
      aria-label={`ID card for ${card.student_name}`}
      className={cn(
        'id-card flex overflow-hidden rounded-xl border border-gray-300 bg-white text-gray-900 shadow-sm',
        '[print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:shadow-none',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
        <div className="truncate text-[11px] font-bold uppercase tracking-wide text-indigo-700">
          {schoolName || 'Student ID'}
        </div>
        <div className="flex items-center gap-2">
          {card.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- student photos come from any host; printed as is
            <img src={card.photo} alt="" className="h-14 w-12 rounded border object-cover" />
          ) : (
            <div className="flex h-14 w-12 items-center justify-center rounded bg-gray-100 text-sm font-bold text-gray-500">
              {initials(card.student_name)}
            </div>
          )}
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-bold leading-tight">{card.student_name}</div>
            <div className="text-[10px] text-gray-600">No. {card.admission_number || '-'}</div>
          </div>
        </div>
        <div className="text-[10px] leading-tight text-gray-600">
          <div className="truncate">{card.class_name ?? ''}</div>
          <div className="truncate">
            {card.academic_year ?? ''}
            {card.card_version > 1 ? ` · Card ${card.card_version}` : ''}
          </div>
        </div>
      </div>
      {/* Server-generated SVG of the signed token (no user content) */}
      <div className="id-card-qr aspect-square h-full p-1.5" dangerouslySetInnerHTML={{ __html: card.qr_svg }} />
    </div>
  );
}

const PRINT_ROOT_CSS = `
@media screen {
  .idc-print-root { display: none !important; }
}
@media print {
  @page { margin: 10mm; }
  html, body { background: #fff !important; }
  body > *:not(.idc-print-root) { display: none !important; }
  .idc-print-root { display: flex !important; flex-wrap: wrap; gap: 6mm; align-content: flex-start; }
}
`;

/** Renders the cards straight under <body>; when printing, only they print, at card size. */
export function IdCardPrintRoot({ cards, schoolName }: { cards: IdCard[]; schoolName?: string | null }) {
  if (typeof document === 'undefined' || cards.length === 0) return null;
  return createPortal(
    <div className="idc-print-root" aria-hidden="true">
      <style>{PRINT_ROOT_CSS + ID_CARD_CSS}</style>
      {cards.map((card) => (
        <IdCardView key={card.student_id} card={card} schoolName={schoolName} />
      ))}
    </div>,
    document.body
  );
}

/**
 * `print()` mounts the print root (render `IdCardPrintRoot` while `printing`), opens the print
 * dialog after it is on the page, and unmounts it afterwards, so it never affects other printing.
 */
export function useIdCardPrint(): { printing: boolean; print: () => void } {
  const [printing, setPrinting] = React.useState(false);
  React.useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // afterprint fires on desktop and mobile browsers alike, including where print() doesn't block.
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);
  return { printing, print: React.useCallback(() => setPrinting(true), []) };
}
