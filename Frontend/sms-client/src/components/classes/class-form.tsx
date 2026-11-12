'use client';

// The class form shared by "Create class" and "Edit class" (Class rosters): grade and section,
// subject and its teacher, dates, name, room and whether the class is active.

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { selectClass } from '@/components/students/admission-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useGrades } from '@/hooks/queries/academic-grades';
import { useSectionsByGrade } from '@/hooks/queries/sections';
import { useSubjects } from '@/hooks/queries/subjects';
import { useTeachers } from '@/hooks/queries/teachers';

export interface ClassFormValues {
  name: string;
  grade_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  start_date: string;
  end_date: string;
  room: string;
  description: string;
  is_active: boolean;
}

export const emptyClassForm = (): ClassFormValues => ({
  name: '',
  grade_id: '',
  section_id: '',
  subject_id: '',
  teacher_id: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  room: '',
  description: '',
  is_active: true,
});

const inputClass = 'h-11 text-base md:h-9 md:text-sm';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 md:p-6" aria-label={title}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ClassForm({
  initial,
  yearName,
  requireName = false,
  activeOnly = false,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: ClassFormValues;
  /** The class's school year, shown read-only */
  yearName: string;
  requireName?: boolean;
  /** Offer only active grades and subjects */
  activeOnly?: boolean;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: ClassFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = React.useState<ClassFormValues>(initial);
  const [errors, setErrors] = React.useState<Partial<Record<keyof ClassFormValues, string>>>({});
  const { data: grades = [], isLoading: gradesLoading } = useGrades(activeOnly);
  const { data: sections = [], isLoading: sectionsLoading } = useSectionsByGrade(values.grade_id);
  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects(activeOnly);
  const { data: teachers = [], isLoading: teachersLoading } = useTeachers();

  const set = <K extends keyof ClassFormValues>(field: K, value: ClassFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (requireName && !values.name.trim()) next.name = 'Enter a name for the class.';
    if (!values.grade_id) next.grade_id = 'Choose a grade.';
    if (!values.section_id) next.section_id = 'Choose a section.';
    if (!values.subject_id) next.subject_id = 'Choose a subject.';
    if (!values.teacher_id) next.teacher_id = 'Choose the teacher.';
    if (!values.start_date) next.start_date = 'Enter the start date.';
    if (values.end_date && values.start_date && values.end_date <= values.start_date) {
      next.end_date = 'Enter an end date after the start date.';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit(values);
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Section title="Grade and subject">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Grade" error={errors.grade_id} required>
            <select
              className={selectClass}
              value={values.grade_id}
              disabled={gradesLoading}
              onChange={(e) => {
                set('grade_id', e.target.value);
                set('section_id', '');
              }}
            >
              <option value="">{gradesLoading ? 'Loading grades…' : 'Choose a grade'}</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Section"
            error={errors.section_id}
            required
            description={values.grade_id ? undefined : 'Choose a grade first.'}
          >
            <select
              className={selectClass}
              value={values.section_id}
              disabled={!values.grade_id || sectionsLoading}
              onChange={(e) => set('section_id', e.target.value)}
            >
              <option value="">{sectionsLoading ? 'Loading sections…' : 'Choose a section'}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Subject" error={errors.subject_id} required>
            <select
              className={selectClass}
              value={values.subject_id}
              disabled={subjectsLoading}
              onChange={(e) => set('subject_id', e.target.value)}
            >
              <option value="">{subjectsLoading ? 'Loading subjects…' : 'Choose a subject'}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Teacher" error={errors.teacher_id} required>
            <select
              className={selectClass}
              value={values.teacher_id}
              disabled={teachersLoading}
              onChange={(e) => set('teacher_id', e.target.value)}
            >
              <option value="">{teachersLoading ? 'Loading teachers…' : 'Choose a teacher'}</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {[t.first_name, t.last_name].filter(Boolean).join(' ') || t.email}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </Section>

      <Section title="Class details">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Name" error={errors.name} required={requireName} description={requireName ? undefined : 'Optional.'}>
            <Input className={inputClass} value={values.name} onChange={(e) => set('name', e.target.value)} />
          </FormField>
          <FormField label="School year">
            <Input className={inputClass} value={yearName || 'No current year'} disabled />
          </FormField>
          <FormField label="Start date" error={errors.start_date} required>
            <Input
              type="date"
              className={inputClass}
              value={values.start_date}
              onChange={(e) => set('start_date', e.target.value)}
            />
          </FormField>
          <FormField label="End date" error={errors.end_date} description="Optional.">
            <Input
              type="date"
              className={inputClass}
              value={values.end_date}
              min={values.start_date || undefined}
              onChange={(e) => set('end_date', e.target.value)}
            />
          </FormField>
          <FormField label="Room" description="Optional.">
            <Input className={inputClass} value={values.room} onChange={(e) => set('room', e.target.value)} />
          </FormField>
          <div className="flex items-center gap-3 md:pt-7">
            <Switch
              id="class-active"
              checked={values.is_active}
              onCheckedChange={(checked) => set('is_active', checked)}
            />
            <label htmlFor="class-active" className="text-sm font-medium">
              Active class
            </label>
          </div>
        </div>
        <FormField label="Description" description="Optional.">
          <Textarea rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
      </Section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11 md:min-h-9" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
