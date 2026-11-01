'use client';

// The class picker (used by the action bar and by the one-student sheet), the one-student sheet,
// and the dialog that lists why nothing was saved (409).
import * as React from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import type { PlacementClass, PlacementProblem, RosterStudent } from '@/services/api/class-placement-service';
import { className as classLabel } from './queries';
import { selectClassName } from './roster-controls';

export function ClassPicker({
  id,
  classes,
  value,
  onChange,
  disabled,
  currentClassId,
  className,
}: {
  id?: string;
  classes: PlacementClass[];
  value: string;
  onChange: (classId: string) => void;
  disabled?: boolean;
  /** Marked "(current class)" in the list. */
  currentClassId?: string | null;
  className?: string;
}) {
  return (
    <select
      id={id}
      className={cn(selectClassName, className)}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{classes.length ? 'Choose a class' : 'No classes this year'}</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {classLabel(c)}
          {c.capacity ? ` (${c.capacity} seats)` : ''}
          {c.id === currentClassId ? ' (current class)' : ''}
        </option>
      ))}
    </select>
  );
}

export function PlaceOneSheet({
  student,
  classes,
  onOpenChange,
  onPlace,
  pending,
}: {
  student: RosterStudent | null;
  classes: PlacementClass[];
  onOpenChange: (open: boolean) => void;
  onPlace: (student: RosterStudent, classId: string) => Promise<boolean>;
  pending: boolean;
}) {
  const pickerId = React.useId();
  const [classId, setClassId] = React.useState('');
  const currentId = student?.enrollment?.class_id ?? null;

  // Start empty each time the sheet opens for another student.
  const studentId = student?.student_id;
  React.useEffect(() => {
    setClassId('');
  }, [studentId]);

  const target = classes.find((c) => c.id === classId);
  const isMove = Boolean(student?.enrollment);
  const verb = isMove ? 'Move' : 'Place';
  const unchanged = Boolean(classId && classId === currentId);

  return (
    <Sheet
      open={Boolean(student)}
      onOpenChange={onOpenChange}
      title={student ? `${verb} ${student.name}` : ''}
      description={
        student?.enrollment
          ? `Now in ${student.enrollment.class_name || 'a class'}. Choose the class to move them to.`
          : 'Not placed in a class this year. Choose a class.'
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!student || !target || unchanged || pending}
            onClick={async () => {
              if (student && target && (await onPlace(student, target.id))) onOpenChange(false);
            }}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {target ? `${isMove ? 'Move to' : 'Place in'} ${classLabel(target)}` : `${verb} student`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={pickerId} className="text-sm font-medium text-foreground">
          Class
        </label>
        <ClassPicker
          id={pickerId}
          classes={classes}
          value={classId}
          onChange={setClassId}
          currentClassId={currentId}
          disabled={pending}
          className="sm:w-full"
        />
        {unchanged ? (
          <p className="text-sm text-muted-foreground">{student?.name} is already in this class.</p>
        ) : null}
      </div>
    </Sheet>
  );
}

export function ProblemsDialog({
  conflict,
  onClose,
}: {
  conflict: { message: string; problems: (PlacementProblem & { name: string })[] } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(conflict)} onClose={onClose} role="alertdialog" className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel
          transition
          className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border bg-background p-6 text-left shadow-xl transition duration-200 ease-out data-[closed]:translate-y-4 data-[closed]:opacity-0 sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground">Nobody was placed</DialogTitle>
              <Description className="mt-1 text-sm text-muted-foreground">
                {conflict?.problems.length
                  ? 'Nothing was saved. Fix these students, or take them out of your selection, then try again.'
                  : conflict?.message || 'Nothing was saved. Check the students you chose and try again.'}
              </Description>
            </div>
          </div>
          {conflict?.problems.length ? (
            <ul className="mt-4 min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border text-sm">
              {conflict.problems.map((p) => (
                <li key={p.student_id} className="px-3 py-2">
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-muted-foreground">{p.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6 flex justify-end">
            <Button type="button" className="min-h-11 w-full sm:w-auto md:min-h-9" onClick={onClose} autoFocus>
              Back to the list
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
