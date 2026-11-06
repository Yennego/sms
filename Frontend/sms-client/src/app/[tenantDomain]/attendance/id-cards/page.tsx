'use client';

// Student ID cards: print a class's QR cards for gate scanning (card size, two per row on A4), and
// issue a new card when one is lost or stolen (the old one stops working at once).

import * as React from 'react';
import { IdCard as IdCardIcon, Lock, Printer, RefreshCw } from 'lucide-react';

import { ClassPicker, useAttendanceAccess } from '@/components/attendance/attendance-ui';
import { ID_CARD_CSS, IdCardView } from '@/components/attendance/id-card';
import { useAttendanceClasses, useClassIdCards, useReissueIdCard } from '@/components/attendance/queries';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { useTenant } from '@/hooks/use-tenant';
import type { IdCard } from '@/types/daily-attendance';

// Only the card sheet prints
const PRINT_CSS = `
@media print {
  @page { margin: 10mm; }
  body * { visibility: hidden !important; }
  #id-card-sheet, #id-card-sheet * { visibility: visible !important; }
  #id-card-sheet { position: absolute; left: 0; top: 0; width: 100%; }
  .id-card-actions { display: none !important; }
}
${ID_CARD_CSS}`;

export default function IdCardsPage() {
  const { tenant } = useTenant();
  const { isLoading, runsSchool } = useAttendanceAccess();
  const classes = useAttendanceClasses(undefined, runsSchool);
  const [classId, setClassId] = React.useState('');
  const cards = useClassIdCards(classId);
  const reissue = useReissueIdCard(classId);
  const [target, setTarget] = React.useState<IdCard | null>(null);
  const list = cards.data ?? [];

  if (isLoading) {
    return (
      <PageShell title="ID cards">
        <Skeleton className="h-48 w-full rounded-xl" />
      </PageShell>
    );
  }
  if (!runsSchool) {
    return (
      <PageShell title="ID cards">
        <EmptyState icon={Lock} description="Only the school's admins print ID cards." />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="ID cards"
      description="Print QR cards for gate scanning. If a card is lost or stolen, issue a new one."
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={() => window.print()} disabled={list.length === 0}>
          <Printer aria-hidden="true" />
          Print {list.length ? `${list.length} ${list.length === 1 ? 'card' : 'cards'}` : 'cards'}
        </Button>
      }
    >
      <style>{PRINT_CSS}</style>
      <ClassPicker
        id="cards-class"
        value={classId}
        onChange={setClassId}
        classes={classes.data ?? []}
        loading={classes.isLoading}
        className="max-w-md"
      />

      {!classId ? (
        <EmptyState icon={IdCardIcon} description="Choose a class to see and print its cards." />
      ) : cards.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : cards.isError ? (
        <EmptyState
          icon={IdCardIcon}
          title="The cards didn't load"
          description={`${errorMessage(cards.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => cards.refetch()}>Try again</Button>}
        />
      ) : list.length === 0 ? (
        <EmptyState icon={IdCardIcon} description="No students are enrolled in this class yet." />
      ) : (
        <div id="id-card-sheet" className="grid grid-cols-1 justify-items-start gap-6 md:grid-cols-2">
          {list.map((card) => (
            <div key={card.student_id} className="space-y-2">
              <IdCardView card={card} schoolName={tenant?.name} />
              <div className="id-card-actions">
                <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9" onClick={() => setTarget(card)}>
                  <RefreshCw aria-hidden="true" />
                  Issue a new card
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`Issue a new card for ${target?.student_name ?? 'this student'}?`}
        description="Their current card stops working straight away. Print the new card and collect the old one if it turns up."
        confirmLabel="Issue a new card"
        destructive
        loading={reissue.isPending}
        onConfirm={async () => {
          if (!target) return;
          try {
            await reissue.mutateAsync(target.student_id);
            notify.success(`A new card is ready for ${target.student_name}. Print it now.`);
          } catch (err) {
            notify.error(errorMessage(err, "The new card wasn't issued. Try again."));
            throw err;
          }
        }}
      />
    </PageShell>
  );
}
