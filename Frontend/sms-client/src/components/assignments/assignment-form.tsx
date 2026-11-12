'use client';

// Set or change an assignment: what it is, for which class and subject, who marks it, when it is
// due and what it is out of. New assignments start as drafts that students don't see yet.

import * as React from 'react';
import { Loader2, Save } from 'lucide-react';

import { useAssignmentSections, useSaveAssignment } from '@/components/assignments/queries';
import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { notify } from '@/components/ui/toaster';
import type { Assignment } from '@/services/api/assignment-service';

type Item = { id: string; name: string };

interface Props {
  /** The assignment to change; omit to set a new one */
  assignment?: Assignment;
  /** The current school year (new assignments belong to it) */
  yearId: string;
  /** Pre-chosen teacher for a new assignment (the teacher setting it) */
  defaultTeacherId?: string;
  subjects: Item[];
  teachers: Item[];
  grades: Item[];
  onClose: () => void;
}

const inputClass = 'h-11 text-base md:h-9 md:text-sm';

export function AssignmentForm({ assignment, yearId, defaultTeacherId, subjects, teachers, grades, onClose }: Props) {
  const save = useSaveAssignment();
  const [form, setForm] = React.useState(() => ({
    title: assignment?.title ?? '',
    due_date: (assignment?.due_date ?? '').slice(0, 10),
    max_score: String(assignment?.max_score ?? 100),
    grade_id: assignment?.grade_id ?? '',
    section_id: assignment?.section_id ?? '',
    subject_id: assignment?.subject_id ?? '',
    teacher_id: assignment?.teacher_id ?? (teachers.some((t) => t.id === defaultTeacherId) ? defaultTeacherId ?? '' : ''),
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const sections = useAssignmentSections(form.grade_id);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'Enter a title, e.g. "Fractions worksheet".';
    if (!form.due_date) next.due_date = 'Choose the day it is due.';
    const max = Number(form.max_score);
    if (!form.max_score || !Number.isFinite(max) || max <= 0) next.max_score = 'Enter the highest mark, e.g. 100.';
    if (!form.grade_id) next.grade_id = 'Choose the grade.';
    if (!form.subject_id) next.subject_id = 'Choose the subject.';
    if (!form.teacher_id) next.teacher_id = 'Choose the teacher who marks it.';
    if (!assignment && !yearId) next.form = "There's no current school year. Set one up before setting assignments.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const data = {
      title: form.title.trim(),
      due_date: form.due_date,
      max_score: Number(form.max_score),
      grade_id: form.grade_id,
      section_id: form.section_id,
      subject_id: form.subject_id,
      teacher_id: form.teacher_id,
    };
    try {
      if (assignment) {
        await save.mutateAsync({ id: assignment.id, data });
        notify.success(`${data.title} is saved.`);
      } else {
        await save.mutateAsync({ data: { ...data, academic_year_id: yearId } });
        notify.success(`${data.title} is saved as a draft. Publish it when students should see it.`);
      }
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "The assignment wasn't saved. Check your connection and try again."));
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !save.isPending && onClose()}
      title={assignment ? `Edit ${assignment.title}` : 'New assignment'}
      description={assignment ? undefined : 'It is saved as a draft. Students see it once you publish it.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {assignment ? 'Save changes' : 'Save draft'}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {errors.form ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errors.form}
          </p>
        ) : null}
        <FormField label="Title" required error={errors.title}>
          <Input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Due" required error={errors.due_date}>
            <Input type="date" className={inputClass} value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </FormField>
          <FormField label="Out of" required error={errors.max_score}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              className={inputClass}
              value={form.max_score}
              onChange={(e) => set('max_score', e.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Grade" required error={errors.grade_id}>
          <select
            className={selectClass}
            value={form.grade_id}
            onChange={(e) => setForm((f) => ({ ...f, grade_id: e.target.value, section_id: '' }))}
          >
            <option value="">Choose a grade</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Section" description="Leave empty to set it for every section of the grade.">
          <select
            className={selectClass}
            value={form.section_id}
            onChange={(e) => set('section_id', e.target.value)}
            disabled={!form.grade_id}
          >
            <option value="">{form.grade_id ? 'Every section' : 'Choose a grade first'}</option>
            {(sections.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            {form.section_id && !(sections.data ?? []).some((s) => s.id === form.section_id) ? (
              <option value={form.section_id}>{assignment?.section_name || 'Current section'}</option>
            ) : null}
          </select>
        </FormField>
        <FormField label="Subject" required error={errors.subject_id}>
          <select className={selectClass} value={form.subject_id} onChange={(e) => set('subject_id', e.target.value)}>
            <option value="">Choose a subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Teacher" required error={errors.teacher_id}>
          <select className={selectClass} value={form.teacher_id} onChange={(e) => set('teacher_id', e.target.value)}>
            <option value="">Choose a teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </FormField>
      </form>
    </Sheet>
  );
}
