'use client';

// The Timetable page. Teachers see their own lessons (today, then the week). Everyone else sees
// the school's timetables by year, grade and section; admins and anyone who manages classes (the
// principal) create, edit and delete them, the rest read only.

import * as React from 'react';
import { CalendarDays, CalendarX, Plus, Printer } from 'lucide-react';

import { useDeleteTimetable, useTimetableGrades, useTimetableSections, useTimetables } from '@/components/timetables/queries';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { notify } from '@/components/ui/toaster';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useAuth } from '@/hooks/use-auth';
import { useDebounce } from '@/hooks/use-debounce';
import type { Timetable } from '@/services/api/timetable-service';

import TeacherWeeklySchedule from './components/TeacherWeeklySchedule';
import TimetableDialog from './components/TimetableDialog';
import TimetableFilters, { type TimetableFilterValues } from './components/TimetableFilters';
import TimetableList, { timetableClassName } from './components/TimetableList';
import TimetableScheduleView from './components/TimetableScheduleView';

export default function TimetablesPage() {
  const { user } = useAuth();
  const isTeacher = Boolean(user?.roles?.some((r) => r.name.toLowerCase() === 'teacher'));
  // Editing follows the server: admins, and anyone who manages classes (e.g. the principal)
  const canEdit = Boolean(
    user?.roles?.some((r) => ['admin', 'superadmin', 'super-admin'].includes(r.name)) ||
      user?.permissions?.includes('manage_classes')
  );

  if (isTeacher) {
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
    return (
      <PageShell
        title="My timetable"
        description="Your lessons from every class timetable."
        secondaryActions={
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Print my week
          </Button>
        }
      >
        <TeacherWeeklySchedule printTitle={name ? `Timetable of ${name}` : 'My timetable'} />
      </PageShell>
    );
  }
  return <SchoolTimetables canEdit={canEdit} />;
}

function SchoolTimetables({ canEdit }: { canEdit: boolean }) {
  const { academicYears, selectedAcademicYearId, setSelectedAcademicYearId, isLoading: yearsLoading } = useAcademicYear();
  const [filters, setFilters] = React.useState({ gradeId: '', sectionId: '', search: '' });
  const search = useDebounce(filters.search.trim(), 300);
  const yearId = selectedAcademicYearId ?? '';

  const grades = useTimetableGrades();
  const sections = useTimetableSections(filters.gradeId);
  const timetables = useTimetables({
    academic_year_id: yearId,
    grade_id: filters.gradeId || undefined,
    section_id: filters.sectionId || undefined,
    search: search || undefined,
  });
  const remove = useDeleteTimetable();

  const [editing, setEditing] = React.useState<{ timetable?: Timetable } | null>(null);
  const [viewing, setViewing] = React.useState<Timetable | null>(null);
  const [deleting, setDeleting] = React.useState<Timetable | null>(null);

  const years = academicYears.map((y) => ({ id: y.id, name: y.name, is_current: y.is_current }));
  const gradeList = grades.data ?? [];
  const sectionList = sections.data ?? [];
  const filtered = Boolean(filters.gradeId || filters.sectionId || filters.search);

  const onFilters = (next: TimetableFilterValues) => {
    if (next.yearId !== yearId) setSelectedAcademicYearId(next.yearId);
    setFilters({ gradeId: next.gradeId, sectionId: next.sectionId, search: next.search });
  };
  const clearFilters = () => setFilters({ gradeId: '', sectionId: '', search: '' });

  const onView = React.useCallback((t: Timetable) => setViewing(t), []);
  const onEdit = React.useCallback((t: Timetable) => setEditing({ timetable: t }), []);
  const onDelete = React.useCallback((t: Timetable) => setDeleting(t), []);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      notify.success(`${deleting.name} is deleted.`);
    } catch (err) {
      notify.error(errorMessage(err, "The timetable wasn't deleted. Check your connection and try again."));
      throw err; // keep the dialog open
    }
  };

  return (
    <PageShell
      title="Timetables"
      description={canEdit ? 'The lessons of each class, week by week.' : 'The lessons of each class, week by week. Only admins and the principal change them.'}
      primaryAction={
        canEdit ? (
          <Button className="min-h-11 md:min-h-9" onClick={() => setEditing({})}>
            <Plus aria-hidden="true" />
            New timetable
          </Button>
        ) : undefined
      }
    >
      <TimetableFilters
        years={years}
        grades={gradeList}
        sections={sectionList}
        value={{ yearId, ...filters }}
        onChange={onFilters}
        onClear={clearFilters}
      />

      {timetables.isError ? (
        <EmptyState
          icon={CalendarX}
          description={`${errorMessage(timetables.error, "The timetables didn't load.")} Check your connection and try again.`}
          action={
            <Button variant="outline" onClick={() => void timetables.refetch()}>
              Try again
            </Button>
          }
        />
      ) : !yearsLoading && academicYears.length === 0 ? (
        <EmptyState icon={CalendarDays} description="There are no school years yet. Set up the school year first." />
      ) : (
        <TimetableList
          loading={!yearId || timetables.isLoading}
          timetables={timetables.data ?? []}
          grades={gradeList}
          sections={sectionList}
          canEdit={canEdit}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          emptyState={
            filtered ? (
              <EmptyState
                icon={CalendarDays}
                description="No timetables match these filters."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={CalendarDays}
                description={canEdit ? 'No timetables for this year yet. Create one for each class.' : 'No timetables for this year yet.'}
                action={
                  canEdit ? (
                    <Button onClick={() => setEditing({})}>
                      <Plus aria-hidden="true" />
                      New timetable
                    </Button>
                  ) : undefined
                }
              />
            )
          }
        />
      )}

      {editing ? (
        <TimetableDialog timetable={editing.timetable} years={years} grades={gradeList} onClose={() => setEditing(null)} />
      ) : null}
      <TimetableScheduleView timetable={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete timetable?'}
        description={
          deleting
            ? `Its ${deleting.time_slots.length} lessons for ${timetableClassName(deleting, gradeList, sectionList)} will be removed. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete timetable"
        destructive
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}
