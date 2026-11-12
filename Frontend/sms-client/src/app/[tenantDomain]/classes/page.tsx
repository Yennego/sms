'use client';

// Class rosters: every class with its year, room and status. Open a class to see and enroll its
// students; "Evaluate promotions" works out who passes in a grade.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, School } from 'lucide-react';

import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { useEvaluatePromotion } from '@/components/classes/queries-setup';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { useClasses } from '@/hooks/queries/classes';
import { useAcademicYears, useEnrollmentGrades, useEnrollmentSections } from '@/hooks/queries/enrollments';
import { useSubjects } from '@/hooks/queries/subjects';
import { useTeachers } from '@/hooks/queries/teachers';
import { useTenantNavigation } from '@/hooks/use-tenant';

type Row = {
  id: string;
  name: string;
  gradeSection: string;
  subjectTeacher: string;
  year: string;
  room: string;
  isActive: boolean;
};

export default function ClassRostersPage() {
  const router = useRouter();
  const { createTenantPath } = useTenantNavigation();
  const classes = useClasses();
  const { data: grades = [] } = useEnrollmentGrades();
  const { data: sections = [] } = useEnrollmentSections();
  const { data: subjects = [] } = useSubjects();
  const { data: teachers = [] } = useTeachers();
  const { data: years = [] } = useAcademicYears();
  const evaluate = useEvaluatePromotion();

  const [evalOpen, setEvalOpen] = React.useState(false);
  const [yearId, setYearId] = React.useState('');
  const [gradeId, setGradeId] = React.useState('');

  const rows = React.useMemo<Row[]>(() => {
    const grade = Object.fromEntries(grades.map((g) => [g.id, g.name]));
    const section = Object.fromEntries(sections.map((s) => [s.id, s.name]));
    const subject = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
    const teacher = Object.fromEntries(
      teachers.map((t) => [t.id, [t.first_name, t.last_name].filter(Boolean).join(' ') || t.email])
    );
    return (classes.data ?? []).map((c) => {
      const gradeSection = [c.grade_name || grade[c.grade_id], c.section_name || section[c.section_id]]
        .filter(Boolean)
        .join(' - ');
      const subjectName = c.subject_name || (c.subject_id ? subject[c.subject_id] : '');
      const teacherName = c.teacher_id ? teacher[c.teacher_id] : '';
      return {
        id: c.id,
        name: c.name || gradeSection || 'Unnamed class',
        gradeSection,
        subjectTeacher: [subjectName, teacherName].filter(Boolean).join(' · '),
        year: c.academic_year_name || '',
        room: c.room || '',
        isActive: Boolean(c.is_active),
      };
    });
  }, [classes.data, grades, sections, subjects, teachers]);

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (r) => `${r.name} ${r.gradeSection} ${r.subjectTeacher}`,
        header: 'Class',
        meta: { label: 'Class' },
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, undefined, { numeric: true }),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            {row.original.gradeSection && row.original.gradeSection !== row.original.name ? (
              <p className="text-sm text-muted-foreground">{row.original.gradeSection}</p>
            ) : null}
            {row.original.subjectTeacher ? (
              <p className="text-sm text-muted-foreground">{row.original.subjectTeacher}</p>
            ) : null}
          </div>
        ),
      },
      { accessorKey: 'year', header: 'Year', cell: ({ row }) => row.original.year || '–' },
      { accessorKey: 'room', header: 'Room', meta: { hideOnMobile: true }, cell: ({ row }) => row.original.room || '–' },
      {
        id: 'status',
        accessorFn: (r) => (r.isActive ? 'Active' : 'Inactive'),
        header: 'Status',
        cell: ({ row }) =>
          row.original.isActive ? (
            <StatusBadge status="success" label="Active" />
          ) : (
            <StatusBadge status="neutral" label="Inactive" />
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => (
          <Button asChild variant="outline" size="sm" className="min-h-11 md:min-h-9">
            <Link href={createTenantPath(`/classes/${row.original.id}`)} onClick={(e) => e.stopPropagation()}>
              Open roster
            </Link>
          </Button>
        ),
      },
    ],
    [createTenantPath]
  );

  const runEvaluation = async () => {
    if (!yearId || !gradeId) {
      notify.error('Choose a year and a grade first.');
      return;
    }
    try {
      const results = await evaluate.mutateAsync({ yearId, gradeId });
      notify.success(`Evaluated ${results.length} enrollment${results.length === 1 ? '' : 's'}.`);
      setEvalOpen(false);
    } catch (err) {
      notify.error(errorMessage(err, "The promotions weren't evaluated. Try again."));
    }
  };

  return (
    <PageShell
      title="Class rosters"
      description="Open a class to see its students, enroll more, or export the list."
      secondaryActions={
        <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setEvalOpen(true)}>
          Evaluate promotions
        </Button>
      }
      primaryAction={
        <Button asChild className="min-h-11 md:min-h-9">
          <Link href={createTenantPath('/classes/new')}>
            <Plus aria-hidden="true" />
            Create class
          </Link>
        </Button>
      }
    >
      {classes.isError ? (
        <EmptyState
          icon={School}
          title="The classes didn't load"
          description={`${errorMessage(classes.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => classes.refetch()}>Try again</Button>}
        />
      ) : (
        <DataTable
          label="Classes"
          columns={columns}
          data={rows}
          loading={classes.isLoading}
          searchable
          searchPlaceholder="Search classes"
          getRowId={(r) => r.id}
          initialSorting={[{ id: 'name', desc: false }]}
          onRowClick={(r) => router.push(createTenantPath(`/classes/${r.id}`))}
          emptyState={
            <EmptyState
              icon={School}
              description="No classes yet. Create a class, then enroll its students."
              action={
                <Button asChild>
                  <Link href={createTenantPath('/classes/new')}>Create class</Link>
                </Button>
              }
            />
          }
        />
      )}

      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evaluate promotions</DialogTitle>
            <DialogDescription>
              Works out which students of a grade pass, from their results for the year. Nobody is moved yet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="eval-year" className="text-sm font-medium">
                Year
              </label>
              <select id="eval-year" className={selectClass} value={yearId} onChange={(e) => setYearId(e.target.value)}>
                <option value="">Choose a year</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="eval-grade" className="text-sm font-medium">
                Grade
              </label>
              <select id="eval-grade" className={selectClass} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                <option value="">Choose a grade</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setEvalOpen(false)}>
              Cancel
            </Button>
            <Button className="min-h-11 md:min-h-9" onClick={runEvaluation} disabled={evaluate.isPending}>
              Evaluate promotions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
