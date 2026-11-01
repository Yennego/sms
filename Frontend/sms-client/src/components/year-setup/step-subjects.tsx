'use client';

import * as React from 'react';
import Link from 'next/link';
import { BookOpen, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import type { SubjectOption, SubjectsStep, TeacherOption, YearSetup } from '@/services/api/year-setup-service';
import { errorText, plural, useSubjectOptions, useTeacherOptions, type YearSetupMutations } from './use-year-setup';
import { TeacherSelect } from './teacher-select';

type SubjectClass = SubjectsStep['classes'][number];

interface LevelGroup {
  gradeId: string;
  gradeName: string;
  sequence: number;
  classes: SubjectClass[];
}

/** Join the subjects step (class ids) to levels through the classes step (class -> grade). */
function groupByLevel(data: YearSetup): LevelGroup[] {
  const gradeOfClass = new Map(data.steps.classes.classes.map((c) => [c.id, { id: c.grade_id, name: c.grade_name }]));
  const sequence = new Map(data.steps.levels.levels.map((l) => [l.id, l.sequence]));
  const groups = new Map<string, LevelGroup>();
  for (const cls of data.steps.subjects.classes) {
    const grade = gradeOfClass.get(cls.class_id) ?? { id: 'unknown', name: 'Other classes' };
    let g = groups.get(grade.id);
    if (!g) {
      g = { gradeId: grade.id, gradeName: grade.name, sequence: sequence.get(grade.id) ?? 9999, classes: [] };
      groups.set(grade.id, g);
    }
    g.classes.push(cls);
  }
  return [...groups.values()].sort((a, b) => a.sequence - b.sequence || a.gradeName.localeCompare(b.gradeName));
}

export interface StepSubjectsProps {
  data: YearSetup;
  mutations: YearSetupMutations;
  school: string;
  onGoToClasses: () => void;
}

export function StepSubjects({ data, mutations, school, onGoToClasses }: StepSubjectsProps) {
  const groups = React.useMemo(() => groupByLevel(data), [data]);
  const teachersQuery = useTeacherOptions();
  const teachers = teachersQuery.data ?? [];
  const [picking, setPicking] = React.useState<LevelGroup | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const { setSubjectTeacher } = mutations;
  const { unassigned_teachers } = data.steps.subjects;

  const saveTeacher = async (classSubjectId: string, label: string, teacherId: string | null) => {
    setSavingId(classSubjectId);
    try {
      await setSubjectTeacher.mutateAsync({ classSubjectId, teacherId });
      notify.success(teacherId ? `Teacher saved for ${label}.` : `${label} has no teacher now.`);
    } catch (err) {
      notify.error(errorText(err, `The teacher for ${label} was not saved.`));
    } finally {
      setSavingId(null);
    }
  };

  if (data.steps.subjects.classes.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No classes this year yet"
        description="Subjects are added to classes. Create this year's classes first."
        action={<Button onClick={onGoToClasses}>Create classes</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {unassigned_teachers > 0
          ? `${plural(unassigned_teachers, 'class subject')} still need a teacher.`
          : 'Choose subjects for each level. They are added to every class of that level.'}
      </p>
      {teachersQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText(teachersQuery.error, 'The teacher list did not load.')}{' '}
          <button type="button" className="min-h-11 font-medium underline" onClick={() => teachersQuery.refetch()}>
            Try again
          </button>
        </p>
      ) : null}

      {groups.map((group) => {
        const empty = group.classes.filter((c) => c.subjects.length === 0).length;
        return (
          <section key={group.gradeId} className="rounded-xl border" aria-labelledby={`lvl-${group.gradeId}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <div className="min-w-0">
                <h3 id={`lvl-${group.gradeId}`} className="font-semibold">{group.gradeName}</h3>
                <p className="text-sm text-muted-foreground">
                  {plural(group.classes.length, 'class', 'classes')}
                  {empty > 0 ? `, ${empty} without subjects` : ''}
                </p>
              </div>
              {group.gradeId !== 'unknown' ? (
                <Button
                  variant={empty > 0 ? 'default' : 'outline'}
                  className="min-h-11 w-full sm:w-auto md:min-h-9"
                  onClick={() => setPicking(group)}
                >
                  Choose subjects
                  <span className="sr-only"> for {group.gradeName}</span>
                </Button>
              ) : null}
            </div>
            <div className="divide-y">
              {group.classes.map((cls) => (
                <div key={cls.class_id} className="p-4">
                  <p className="mb-2 text-sm font-medium">{cls.class_name}</p>
                  {cls.subjects.length === 0 ? (
                    <StatusBadge status="pending" label="No subjects yet" />
                  ) : (
                    <ul className="grid gap-2">
                      {cls.subjects.map((s) => (
                        <li key={s.class_subject_id} className="grid gap-1 sm:grid-cols-[1fr_minmax(0,18rem)] sm:items-center sm:gap-3">
                          <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                            {s.subject_name}
                            {s.teacher_id ? null : <StatusBadge status="pending" label="No teacher" />}
                          </span>
                          <TeacherSelect
                            teachers={teachers}
                            value={s.teacher_id}
                            currentName={s.teacher_name}
                            label={`Teacher for ${s.subject_name} in ${cls.class_name}`}
                            placeholder={teachersQuery.isLoading ? 'Loading teachers…' : 'Choose a teacher'}
                            disabled={teachersQuery.isLoading}
                            saving={savingId === s.class_subject_id}
                            onChange={(id) => saveTeacher(s.class_subject_id, `${s.subject_name} in ${cls.class_name}`, id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <ChooseSubjectsSheet
        group={picking}
        onClose={() => setPicking(null)}
        teachers={teachers}
        mutations={mutations}
        school={school}
      />
    </div>
  );
}

function ChooseSubjectsSheet({
  group,
  onClose,
  teachers,
  mutations,
  school,
}: {
  group: LevelGroup | null;
  onClose: () => void;
  teachers: TeacherOption[];
  mutations: YearSetupMutations;
  school: string;
}) {
  const subjectsQuery = useSubjectOptions();
  const subjects: SubjectOption[] = React.useMemo(
    () => [...(subjectsQuery.data ?? [])].filter((s) => s.is_active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [subjectsQuery.data],
  );
  const [chosen, setChosen] = React.useState<Set<string>>(new Set());
  const [chosenTeachers, setChosenTeachers] = React.useState<Record<string, string>>({});
  const { applySubjects } = mutations;

  // How many of the level's classes already have each subject
  const coverage = React.useMemo(() => {
    const m = new Map<string, number>();
    group?.classes.forEach((c) => c.subjects.forEach((s) => m.set(s.subject_id, (m.get(s.subject_id) ?? 0) + 1)));
    return m;
  }, [group]);
  const classCount = group?.classes.length ?? 0;

  React.useEffect(() => {
    if (group) {
      setChosen(new Set());
      setChosenTeachers({});
    }
  }, [group]);

  const toggle = (id: string, on: boolean) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    if (!on) {
      setChosenTeachers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const subjectIds = [...new Set([...chosen, ...Object.keys(chosenTeachers)])];

  const apply = async () => {
    if (!group) return;
    try {
      await applySubjects.mutateAsync({ grade_id: group.gradeId, subject_ids: subjectIds, teachers: chosenTeachers });
      notify.success(`Subjects saved for every ${group.gradeName} class.`);
      onClose();
    } catch (err) {
      notify.error(errorText(err, 'The subjects were not saved.'));
    }
  };

  return (
    <Sheet
      open={Boolean(group)}
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={group ? `Subjects for ${group.gradeName}` : 'Subjects'}
      description={
        group
          ? `Ticked subjects are added to all ${plural(classCount, 'class', 'classes')} that don't have them yet. A teacher chosen here is set for that subject in every ${group.gradeName} class.`
          : undefined
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button className="min-h-11" onClick={apply} disabled={applySubjects.isPending || subjectIds.length === 0}>
            {applySubjects.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {group ? `Apply to ${plural(classCount, 'class', 'classes')}` : 'Apply'}
          </Button>
        </div>
      }
    >
      {subjectsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading subjects…</p>
      ) : subjectsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText(subjectsQuery.error, 'The subject list did not load.')}{' '}
          <button type="button" className="min-h-11 font-medium underline" onClick={() => subjectsQuery.refetch()}>
            Try again
          </button>
        </p>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No subjects yet.{' '}
          <Link href={`/${school}/academics/subjects`} className="font-medium text-primary underline-offset-4 hover:underline">
            Add subjects
          </Link>{' '}
          first, then come back here.
        </p>
      ) : (
        <ul className="grid gap-3">
          {subjects.map((s) => {
            const have = coverage.get(s.id) ?? 0;
            const onAll = classCount > 0 && have >= classCount;
            const checked = onAll || chosen.has(s.id);
            return (
              <li key={s.id} className="rounded-lg border p-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={onAll}
                    onChange={(e) => toggle(s.id, e.target.checked)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.name}</span>
                    {onAll ? (
                      <span className="block text-xs text-muted-foreground">On every class</span>
                    ) : have > 0 ? (
                      <span className="block text-xs text-muted-foreground">On {have} of {classCount} classes</span>
                    ) : null}
                  </span>
                </label>
                {checked ? (
                  <TeacherSelect
                    className="mt-2"
                    teachers={teachers}
                    value={chosenTeachers[s.id] ?? null}
                    label={`Teacher for ${s.name} in all classes`}
                    placeholder="Same teacher for all classes (optional)"
                    onChange={(id) =>
                      setChosenTeachers((prev) => {
                        const next = { ...prev };
                        if (id) next[s.id] = id;
                        else delete next[s.id];
                        return next;
                      })
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
