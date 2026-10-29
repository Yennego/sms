'use client';

// Printing report cards without the app around them.
//
// <ReportCardPrintRoot> renders the cards into a portal that is a direct child of <body>. On
// screen it is hidden; when printing, every other child of <body> (the app shell, dialogs,
// toasts) is hidden instead, so only the cards print: A4 portrait, one card per page.
// The app shell itself is not touched.
//
//   const print = usePrintRequest();
//   <Button onClick={() => { setTarget('all'); print(); }}>Print all</Button>
//   <ReportCardPrintRoot cards={cards} school={school} />
import * as React from 'react';
import { createPortal } from 'react-dom';

import type { ReportCardData, ReportCardSchool } from '@/services/api/results-service';
import { ReportCard } from './report-card';

const PRINT_CSS = `
@media screen {
  .rc-print-root { display: none !important; }
}
@media print {
  @page { size: A4 portrait; margin: 10mm; }
  html, body { background: #fff !important; }
  body > *:not(.rc-print-root) { display: none !important; }
  .rc-print-root { display: block !important; }
  .rc-print-root .rc-sheet { break-after: page; page-break-after: always; }
  .rc-print-root .rc-sheet:last-child { break-after: auto; page-break-after: auto; }
}
`;

const subscribe = () => () => {};

/** True after hydration (the portal needs document.body). */
function useIsClient() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

export interface ReportCardPrintRootProps {
  cards: ReportCardData[];
  school: ReportCardSchool;
  /** Passed to each ReportCard (default true: unpublished columns print as "—"). */
  hideUnpublished?: boolean;
}

export function ReportCardPrintRoot({ cards, school, hideUnpublished = true }: ReportCardPrintRootProps) {
  const isClient = useIsClient();
  if (!isClient || cards.length === 0) return null;
  return createPortal(
    <div className="rc-print-root" aria-hidden="true">
      <style>{PRINT_CSS}</style>
      {cards.map((card) => (
        <ReportCard
          key={card.student.id || card.student.name}
          card={card}
          school={school}
          hideUnpublished={hideUnpublished}
        />
      ))}
    </div>,
    document.body
  );
}

/**
 * Returns a function that opens the browser's print dialog after the next render, so state
 * changed in the same click (which cards to print) is on the page first.
 */
export function usePrintRequest(): () => void {
  const [request, setRequest] = React.useState(0);
  React.useEffect(() => {
    if (request === 0) return;
    const frame = window.requestAnimationFrame(() => window.print());
    return () => window.cancelAnimationFrame(frame);
  }, [request]);
  return React.useCallback(() => setRequest((n) => n + 1), []);
}
