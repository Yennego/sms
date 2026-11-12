'use client';

// Dialogs of the Subject assignments page: give a teacher subjects, edit one assignment, put a
// teacher on a subject (or move several), choose a class sponsor, and list a subject's students.

import * as React from 'react';
import { Loader2, Users } from 'lucide-react';

import { useAssignmentStudents } from '@/components/classes/queries-setup';
import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import {
  useAssignSponsor,
  useCreateAssignment,
  useUpdateAssignment,
} from '@/hooks/queries/teacher-assignments';
import type { Teacher } from '@/types/teacher';
import type { ClassSubjectAssignment, TeacherSubjectAssignment } from '@/types/teacher-subject-assignment';

const inputClass = 'h-11 text-base md:h-9 md:text-sm';
const footerButton = 'min-h-11 md:min-h-9';

export const teacherName = (t: Pick<Teacher, 'first_name' | 'last_name' | 'email'>) =>
  [t.first_name, t.last_name].filter(Boolean).join(' ') || t.email;

export const slotKey = (s: Pick<ClassSubjectAssignment, 'grade_id' | 'section_id' | 'subject_id'>) =>
  `${s.grade_id}:${s.section_id}:${s.subject_id}`;

const sameId = (a?: string | null, b?: string | null) =>
  Boolean(a && b && a.toLowerCase().trim() === b.toLowerCase().trim());

function TeacherSelect({
  id,
  value,
  onChange,
  teachers,
  withEmployeeId = false,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  teachers: Teacher[];
  withEmployeeId?: boolean;
}) {
  return (
    <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a teacher</option>
      {teachers.map((t) => (
        <option key={t.id} value={t.id}>
          {teacherName(t)}
          {withEmployeeId && t.employee_id ? ` (${t.employee_id})` : ''}
        </option>
      ))}
    </select>
  );
}

/** Give one teacher several subjects that have no teacher yet. */
export function AssignSubjectsDialog({
  teacher,
  onClose,
  slots,
  grades,
  subjects,
  academicYearId,
}: {
  teacher: Teacher | null;
  onClose: () => void;
  slots: ClassSubjectAssignment[];
  grades: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  academicYearId: string;
}) {
  const create = useCreateAssignment();
  const [search, setSearch] = React.useState('');
  const [gradeId, setGradeId] = React.useState('');
  const [subjectId, setSubjectId] = React.useState('');
  const [room, setRoom] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    // A fresh dialog for each teacher
    setSearch('');
    setGradeId('');
    setSubjectId('');
    setRoom('');
    setSelected([]);
  }, [teacher?.id]);

  const shown = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return slots.filter(
      (s) =>
        (!gradeId || s.grade_id === gradeId) &&
        (!subjectId || s.subject_id === subjectId) &&
        (!term ||
          `${s.class_name} ${s.subject_name} ${s.grade_name} ${s.section_name}`.toLowerCase().includes(term))
    );
  }, [slots, search, gradeId, subjectId]);

  const groups = React.useMemo(() => {
    const map = new Map<string, ClassSubjectAssignment[]>();
    for (const s of shown) {
      const key = `${s.grade_name} - ${s.section_name}`;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [shown]);

  const open = shown.filter((s) => !s.is_assigned);

  const assign = async () => {
    if (!teacher) return;
    const chosen = slots.filter((s) => selected.includes(slotKey(s)) && !s.is_assigned);
    if (!chosen.length) return;
    setSaving(true);
    const results = await Promise.allSettled(
      chosen.map((s) =>
        create.mutateAsync({
          teacher_id: teacher.id,
          grade_id: s.grade_id,
          section_id: s.section_id,
          subject_id: s.subject_id,
          academic_year_id: academicYearId,
          room: room.trim() || undefined,
          is_active: true,
          start_date: new Date().toISOString().split('T')[0],
        })
      )
    );
    setSaving(false);
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    const done = results.length - failed.length;
    if (done) notify.success(`${teacherName(teacher)} now teaches ${done} more subject${done === 1 ? '' : 's'}.`);
    if (failed.length) {
      notify.error(
        `${failed.length} subject${failed.length === 1 ? " wasn't" : "s weren't"} assigned. ${errorMessage(failed[0].reason, 'Try again.')}`
      );
      return;
    }
    onClose();
  };

  return (
    <Dialog open={Boolean(teacher)} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign subjects to {teacher ? teacherName(teacher) : ''}</DialogTitle>
          <DialogDescription>
            Choose the subjects {teacher?.first_name || 'this teacher'} will teach. Subjects that already have a teacher
            can be moved from the All subjects view.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-2">
            <label htmlFor="assign-search" className="text-sm font-medium">
              Search
            </label>
            <Input id="assign-search" className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="assign-grade" className="text-sm font-medium">
              Grade
            </label>
            <select id="assign-grade" className={selectClass} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              <option value="">All grades</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="assign-subject" className="text-sm font-medium">
              Subject
            </label>
            <select
              id="assign-subject"
              className={selectClass}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={footerButton}
            onClick={() => setSelected(open.map(slotKey))}
            disabled={!open.length}
          >
            Select {open.length} without a teacher
          </Button>
          <Button variant="ghost" size="sm" className={footerButton} onClick={() => setSelected([])} disabled={!selected.length}>
            Clear selection
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
          {groups.length === 0 ? (
            <EmptyState bare description="No subjects match. Change the search or filters." />
          ) : (
            groups.map(([group, items]) => (
              <fieldset key={group} className="border-b p-3 last:border-b-0">
                <legend className="px-1 text-sm font-semibold">{group}</legend>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  {items.map((s) => {
                    const key = slotKey(s);
                    const theirs = s.is_assigned && sameId(s.teacher_id, teacher?.id);
                    const id = `slot-${key}`;
                    return (
                      <li key={key}>
                        <label
                          htmlFor={id}
                          className={`flex min-h-11 items-center gap-3 rounded-md px-2 ${s.is_assigned ? 'text-muted-foreground' : 'cursor-pointer hover:bg-muted'}`}
                        >
                          <Checkbox
                            id={id}
                            checked={theirs || selected.includes(key)}
                            disabled={s.is_assigned}
                            onCheckedChange={(checked) =>
                              setSelected((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)))
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{s.subject_name}</span>
                            {s.is_assigned ? (
                              <span className="block text-xs">
                                {theirs ? 'Already teaches this' : `Taught by ${s.teacher_name || 'another teacher'}`}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))
          )}
        </div>

        <FormField label="Room" description="Optional. Used for every subject you assign now.">
          <Input className={inputClass} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room 101" />
        </FormField>

        <DialogFooter>
          <Button variant="outline" className={footerButton} onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className={footerButton} onClick={assign} disabled={saving || selected.length === 0}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {selected.length ? `Assign ${selected.length} subject${selected.length === 1 ? '' : 's'}` : 'Assign subjects'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Room, active and notes of one assignment. */
export function EditAssignmentDialog({
  assignment,
  title,
  teacherLabel,
  onClose,
}: {
  assignment: TeacherSubjectAssignment | null;
  /** "Mathematics, Grade 7 - A" */
  title: string;
  teacherLabel: string;
  onClose: () => void;
}) {
  const update = useUpdateAssignment();
  const [room, setRoom] = React.useState('');
  const [active, setActive] = React.useState(true);
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!assignment) return;
    setRoom(assignment.room || '');
    setActive(assignment.is_active ?? true);
    setNotes(assignment.notes || '');
  }, [assignment]);

  const save = async () => {
    if (!assignment) return;
    try {
      await update.mutateAsync({
        id: assignment.id,
        data: { room: room || undefined, is_active: active, notes: notes || undefined },
      });
      notify.success('The assignment is saved.');
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "The assignment wasn't saved. Try again."));
    }
  };

  return (
    <Dialog open={Boolean(assignment)} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {title}</DialogTitle>
          <DialogDescription>Taught by {teacherLabel}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Room">
            <Input className={inputClass} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room 204" />
          </FormField>
          <div className="flex items-center gap-3">
            <Switch id="assignment-active" checked={active} onCheckedChange={setActive} />
            <label htmlFor="assignment-active" className="text-sm font-medium">
              Active assignment
            </label>
          </div>
          <FormField label="Notes" description="Only staff see these.">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" className={footerButton} onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button className={footerButton} onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Choose a teacher for one subject, or for several selected assignments at once. */
export function ChooseTeacherDialog({
  open,
  title,
  description,
  initialTeacherId,
  confirmLabel,
  teachers,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  initialTeacherId: string;
  confirmLabel: string;
  teachers: Teacher[];
  pending: boolean;
  onConfirm: (teacherId: string) => void;
  onClose: () => void;
}) {
  const [teacherId, setTeacherId] = React.useState(initialTeacherId);
  React.useEffect(() => {
    if (open) setTeacherId(initialTeacherId);
  }, [open, initialTeacherId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor="choose-teacher" className="text-sm font-medium">
            Teacher
          </label>
          <TeacherSelect id="choose-teacher" value={teacherId} onChange={setTeacherId} teachers={teachers} />
        </div>
        <DialogFooter>
          <Button variant="outline" className={footerButton} onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button className={footerButton} onClick={() => onConfirm(teacherId)} disabled={pending || !teacherId}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The class sponsor of a section. */
export function SponsorDialog({
  section,
  teachers,
  onClose,
}: {
  section: { id: string; name: string; teacherId: string | null } | null;
  teachers: Teacher[];
  onClose: () => void;
}) {
  const assign = useAssignSponsor();
  const [teacherId, setTeacherId] = React.useState('');
  React.useEffect(() => {
    setTeacherId(section?.teacherId ?? '');
  }, [section]);

  const save = async () => {
    if (!section || !teacherId) return;
    try {
      await assign.mutateAsync({ sectionId: section.id, teacherId });
      const t = teachers.find((x) => x.id === teacherId);
      notify.success(`${t ? teacherName(t) : 'The teacher'} is now the sponsor of ${section.name}.`);
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "The sponsor wasn't saved. Try again."));
    }
  };

  return (
    <Dialog open={Boolean(section)} onOpenChange={(o) => !o && !assign.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Class sponsor of {section?.name}</DialogTitle>
          <DialogDescription>The class sponsor is the teacher in charge of this class.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor="sponsor-teacher" className="text-sm font-medium">
            Teacher
          </label>
          <TeacherSelect id="sponsor-teacher" value={teacherId} onChange={setTeacherId} teachers={teachers} withEmployeeId />
        </div>
        <DialogFooter>
          <Button variant="outline" className={footerButton} onClick={onClose} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button className={footerButton} onClick={save} disabled={assign.isPending || !teacherId}>
            {assign.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save sponsor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The students of the class a subject assignment belongs to. */
export function AssignmentStudentsDialog({
  assignment,
  onClose,
}: {
  assignment: { id: string; title: string; teacher?: string } | null;
  onClose: () => void;
}) {
  const students = useAssignmentStudents(assignment?.id ?? null);
  const [search, setSearch] = React.useState('');
  React.useEffect(() => setSearch(''), [assignment?.id]);

  const list = students.data ?? [];
  const term = search.trim().toLowerCase();
  const shown = term
    ? list.filter((s) =>
        `${s.first_name ?? ''} ${s.last_name ?? ''} ${s.admission_number ?? ''}`.toLowerCase().includes(term)
      )
    : list;

  return (
    <Dialog open={Boolean(assignment)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Students: {assignment?.title}</DialogTitle>
          <DialogDescription>
            {assignment?.teacher ? `Taught by ${assignment.teacher}. ` : ''}
            {students.isSuccess ? `${list.length} student${list.length === 1 ? '' : 's'}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor="students-search" className="text-sm font-medium">
            Search by name or admission number
          </label>
          <Input id="students-search" className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {students.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : students.isError ? (
            <EmptyState
              bare
              icon={Users}
              description="The students didn't load. Check your connection and try again."
              action={<Button onClick={() => students.refetch()}>Try again</Button>}
            />
          ) : shown.length === 0 ? (
            <EmptyState
              bare
              icon={Users}
              description={term ? 'No students match your search.' : 'No students are enrolled in this class yet.'}
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {shown.map((s) => (
                <li key={s.id} className="p-3">
                  <p className="font-medium">{[s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed student'}</p>
                  <p className="text-sm text-muted-foreground">
                    {[s.admission_number, s.gender && s.gender !== 'Unknown' ? s.gender : ''].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className={footerButton} onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
