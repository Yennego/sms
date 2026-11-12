'use client';

// Create or edit a timetable: what it covers (year, grade, optional section), then its lessons.
// "Add to several days" adds the same lesson on each chosen day; every lesson can then be changed.

import * as React from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';

import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { useSaveTimetable, useTimetableSections, useTimetableSubjects } from '@/components/timetables/queries';
import { dayLabel, hhmm, WEEKDAYS } from '@/components/timetables/timetable-ui';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import type { Timetable, TimetableCreate } from '@/services/api/timetable-service';

type Item = { id: string; name: string };
type Year = Item & { is_current?: boolean };

interface SlotDraft {
  key: number;
  name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  class_id: string;
}

interface Props {
  /** The timetable to edit; omit to create one */
  timetable?: Timetable;
  years: Year[];
  grades: Item[];
  onClose: () => void;
}

const inputClass = 'h-11 text-base md:h-9 md:text-sm';
let nextKey = 1;

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

function initialForm(timetable: Timetable | undefined, years: Year[]) {
  if (!timetable) {
    return {
      name: '',
      academic_year_id: years.find((y) => y.is_current)?.id || years[0]?.id || '',
      grade_id: '',
      section_id: '',
      is_active: true,
    };
  }
  return {
    name: timetable.name,
    academic_year_id: timetable.academic_year_id || years.find((y) => y.name === timetable.academic_year)?.id || '',
    grade_id: timetable.grade_id,
    section_id: timetable.section_id || '',
    is_active: timetable.is_active,
  };
}

export default function TimetableDialog({ timetable, years, grades, onClose }: Props) {
  const save = useSaveTimetable();
  const [form, setForm] = React.useState(() => initialForm(timetable, years));
  const [slots, setSlots] = React.useState<SlotDraft[]>(() =>
    (timetable?.time_slots ?? []).map((s) => ({
      key: nextKey++,
      name: s.name || '',
      day_of_week: (s.day_of_week || '').toLowerCase(),
      start_time: hhmm(s.start_time),
      end_time: hhmm(s.end_time),
      class_id: s.class_id || '',
    }))
  );
  const [quick, setQuick] = React.useState({ name: '', class_id: '', start_time: '', end_time: '', days: [] as string[] });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const sections = useTimetableSections(form.grade_id);
  const subjects = useTimetableSubjects(form.academic_year_id, form.grade_id, form.section_id);
  const subjectList = subjects.data ?? [];

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const changeSlot = (key: number, patch: Partial<SlotDraft>) =>
    setSlots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const quickReady = Boolean(quick.class_id && quick.start_time && quick.end_time && quick.days.length);
  const addToDays = () => {
    if (!quickReady) return;
    setSlots((list) => [
      ...list,
      ...quick.days.map((day) => ({
        key: nextKey++,
        name: quick.name || 'Period',
        day_of_week: day,
        start_time: quick.start_time,
        end_time: quick.end_time,
        class_id: quick.class_id,
      })),
    ]);
    // Keep the subject and times for the next days
    setQuick((q) => ({ ...q, days: [] }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter a name, e.g. "Grade 7 timetable".';
    if (!form.academic_year_id) next.academic_year_id = 'Choose the school year.';
    if (!form.grade_id) next.grade_id = 'Choose the grade.';
    if (slots.some((s) => !s.day_of_week || !s.start_time || !s.end_time)) {
      next.slots = 'Every lesson needs a day, a start time and an end time.';
    } else if (slots.some((s) => minutes(s.end_time) <= minutes(s.start_time))) {
      next.slots = 'Every lesson must end after it starts.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const data: TimetableCreate = {
      name: form.name.trim(),
      academic_year_id: form.academic_year_id,
      grade_id: form.grade_id,
      section_id: form.section_id || undefined,
      is_active: form.is_active,
      time_slots: slots.map((s) => ({
        name: s.name.trim(),
        start_time: s.start_time,
        end_time: s.end_time,
        day_of_week: s.day_of_week,
        class_id: s.class_id || undefined,
      })),
    };
    try {
      await save.mutateAsync({ id: timetable?.id, data });
      notify.success(timetable ? `${data.name} is saved.` : `${data.name} is created.`);
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "The timetable wasn't saved. Check your connection and try again."));
    }
  };

  const subjectOptions = (
    <>
      <option value="">{subjects.isLoading ? 'Loading subjects…' : 'Choose a subject'}</option>
      {subjectList.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {timetable ? `Edit ${timetable.name}` : 'New timetable'}
          </DialogTitle>
          <DialogDescription>Choose the class it covers, then add its lessons.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Details">
            <FormField label="Name" required error={errors.name} className="sm:col-span-2">
              <Input
                className={inputClass}
                value={form.name}
                placeholder="e.g. Grade 7 timetable"
                onChange={(e) => setField('name', e.target.value)}
              />
            </FormField>
            <FormField label="School year" required error={errors.academic_year_id}>
              <select className={selectClass} value={form.academic_year_id} onChange={(e) => setField('academic_year_id', e.target.value)}>
                <option value="">Choose a year</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.is_current ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </FormField>
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
            <FormField label="Section" description="Leave empty to use this timetable for every section of the grade.">
              <select
                className={selectClass}
                value={form.section_id}
                onChange={(e) => setField('section_id', e.target.value)}
                disabled={!form.grade_id}
              >
                <option value="">{form.grade_id ? 'Every section' : 'Choose a grade first'}</option>
                {form.grade_id
                  ? (sections.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  : null}
              </select>
            </FormField>
            <div className="flex min-h-11 items-center gap-3 sm:self-end md:min-h-9">
              <Switch id="tt-active" checked={form.is_active} onCheckedChange={(on) => setField('is_active', on)} />
              <label htmlFor="tt-active" className="text-sm">
                Active (students and teachers see it)
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border p-4" aria-label="Add to several days">
            <div>
              <h3 className="font-semibold">Add a lesson to several days</h3>
              <p className="text-sm text-muted-foreground">
                {form.grade_id ? 'Pick the subject, the times and the days.' : 'Choose a grade above to see its subjects.'}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Subject" className="sm:col-span-2">
                <select
                  className={selectClass}
                  value={quick.class_id}
                  onChange={(e) => setQuick((q) => ({ ...q, class_id: e.target.value }))}
                  disabled={!form.grade_id}
                >
                  {subjectOptions}
                </select>
              </FormField>
              <FormField label="Starts">
                <Input type="time" className={inputClass} value={quick.start_time} onChange={(e) => setQuick((q) => ({ ...q, start_time: e.target.value }))} />
              </FormField>
              <FormField label="Ends">
                <Input type="time" className={inputClass} value={quick.end_time} onChange={(e) => setQuick((q) => ({ ...q, end_time: e.target.value }))} />
              </FormField>
              <FormField label="Label (optional)" className="sm:col-span-2">
                <Input className={inputClass} placeholder="e.g. Period 1" value={quick.name} onChange={(e) => setQuick((q) => ({ ...q, name: e.target.value }))} />
              </FormField>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Days</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const on = quick.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setQuick((q) => ({ ...q, days: on ? q.days.filter((d) => d !== day) : [...q.days, day] }))
                      }
                      className={cn(
                        'min-h-11 min-w-14 rounded-md border px-3 text-sm font-medium md:min-h-9',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                      )}
                    >
                      {dayLabel(day).slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={addToDays} disabled={!quickReady}>
              <Plus aria-hidden="true" />
              {quick.days.length > 1 ? `Add to ${quick.days.length} days` : 'Add lesson'}
            </Button>
          </section>

          <section className="space-y-3" aria-label="Lessons">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                Lessons <span className="font-normal text-muted-foreground">({slots.length})</span>
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 md:min-h-9"
                onClick={() =>
                  setSlots((list) => [...list, { key: nextKey++, name: '', day_of_week: '', start_time: '', end_time: '', class_id: '' }])
                }
              >
                <Plus aria-hidden="true" />
                Add one lesson
              </Button>
            </div>
            {errors.slots ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.slots}
              </p>
            ) : null}
            {slots.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No lessons yet. Add them above.
              </p>
            ) : (
              <ul className="space-y-3">
                {slots.map((s, i) => (
                  <li key={s.key} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-[8rem_7rem_7rem_7rem_minmax(0,1fr)_auto] lg:items-end">
                    <FormField label="Day">
                      <select className={selectClass} value={s.day_of_week} onChange={(e) => changeSlot(s.key, { day_of_week: e.target.value })}>
                        <option value="">Choose</option>
                        {WEEKDAYS.map((d) => (
                          <option key={d} value={d}>
                            {dayLabel(d)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Label">
                      <Input className={inputClass} placeholder="Period" value={s.name} onChange={(e) => changeSlot(s.key, { name: e.target.value })} />
                    </FormField>
                    <FormField label="Starts">
                      <Input type="time" className={inputClass} value={s.start_time} onChange={(e) => changeSlot(s.key, { start_time: e.target.value })} />
                    </FormField>
                    <FormField label="Ends">
                      <Input type="time" className={inputClass} value={s.end_time} onChange={(e) => changeSlot(s.key, { end_time: e.target.value })} />
                    </FormField>
                    <FormField label="Subject">
                      <select className={selectClass} value={s.class_id} onChange={(e) => changeSlot(s.key, { class_id: e.target.value })}>
                        {subjectOptions}
                        {s.class_id && !subjectList.some((o) => o.id === s.class_id) ? (
                          <option value={s.class_id}>
                            {timetable?.time_slots.find((t) => t.class_id === s.class_id)?.subject_name || 'Current subject'}
                          </option>
                        ) : null}
                      </select>
                    </FormField>
                    <Button
                      variant="ghost"
                      className="min-h-11 text-destructive hover:text-destructive md:min-h-9"
                      onClick={() => setSlots((list) => list.filter((x) => x.key !== s.key))}
                    >
                      <Trash2 aria-hidden="true" />
                      <span className="lg:sr-only">Remove lesson {i + 1}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex flex-col-reverse gap-2 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button className="min-h-11 md:min-h-9" onClick={submit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {timetable ? 'Save timetable' : 'Create timetable'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
