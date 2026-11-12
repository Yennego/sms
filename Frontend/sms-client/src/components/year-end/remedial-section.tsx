'use client';

// One student's remedial work, shown on the page under a list (not in a dialog: the panel's
// pickers open their own pop-ups). Scrolls into view when it opens.

import * as React from 'react';
import { X } from 'lucide-react';

import RemedialPanel from '@/components/students/remedial-panel';
import { Button } from '@/components/ui/button';

export function RemedialSection({
  studentName,
  enrollmentId,
  onClose,
}: {
  studentName: string;
  enrollmentId: string;
  /** Called when closed; refresh what the panel may have changed */
  onClose: () => void;
}) {
  const headingId = React.useId();
  // Stable, so it runs only when the section mounts (a new student remounts it through the key)
  const scrollIn = React.useCallback((el: HTMLElement | null) => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  return (
    <section
      key={enrollmentId}
      ref={scrollIn}
      aria-labelledby={headingId}
      className="flex scroll-mt-4 flex-col gap-3 rounded-xl border bg-muted/30 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            Remedial work: {studentName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Schedule sessions and record each new score. Passing all of them can move a Conditional student up a grade.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-11 shrink-0 md:size-9" onClick={onClose}>
          <X aria-hidden="true" />
          <span className="sr-only">Close remedial work</span>
        </Button>
      </div>
      <RemedialPanel enrollmentId={enrollmentId} />
    </section>
  );
}
