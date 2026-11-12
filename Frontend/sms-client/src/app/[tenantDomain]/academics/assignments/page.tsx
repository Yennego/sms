'use client';

// Assignments (the Homework area). Students see their class's assignments and hand work in;
// teachers and admins set, edit, publish, delete and mark them; anyone else reads the list.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LayoutGrid, Plus } from 'lucide-react';

import { AssignmentForm } from '@/components/assignments/assignment-form';
import { useAssignmentsAccess } from '@/components/assignments/assignment-ui';
import {
  useAssignmentGrades,
  useAssignmentList,
  useAssignmentSections,
  useAssignmentSubjects,
  useAssignmentTeachers,
  type AssignmentListFilters,
} from '@/components/assignments/queries';
import { StaffAssignments } from '@/components/assignments/staff-assignments';
import { StudentAssignments } from '@/components/assignments/student-assignments';
import { useCurrentYear } from '@/components/students/queries';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import type { Assignment } from '@/services/api/assignment-service';

export default function AssignmentsPage() {
  const { user, isLoading, isStudent } = useAssignmentsAccess();

  if (isLoading || !user) {
    return (
      <PageShell title="Assignments">
        <Skeleton className="h-48 w-full rounded-xl" />
      </PageShell>
    );
  }
  if (isStudent) {
    return (
      <PageShell title="My assignments" description="Work your teachers have set for your class.">
        <StudentAssignments studentId={user.id} />
      </PageShell>
    );
  }
  return <StaffAssignmentsPage />;
}

function StaffAssignmentsPage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const base = `/${tenantDomain}`;
  const { user, canManage, isTeacher } = useAssignmentsAccess();

  const [filters, setFilters] = React.useState<AssignmentListFilters>({ subjectId: '', teacherId: '', gradeId: '', sectionId: '' });
  const [editing, setEditing] = React.useState<{ assignment?: Assignment } | null>(null);

  const list = useAssignmentList(filters);
  const subjects = useAssignmentSubjects();
  const teachers = useAssignmentTeachers(true);
  const grades = useAssignmentGrades();
  const sections = useAssignmentSections(filters.gradeId);
  const year = useCurrentYear();

  const onEdit = React.useCallback((a: Assignment) => setEditing({ assignment: a }), []);
  const onCreate = React.useCallback(() => setEditing({}), []);

  return (
    <PageShell
      title="Assignments"
      description={
        canManage
          ? 'Set work for a class, publish it when students should see it, and enter the marks in the gradebook.'
          : 'The work set for each class.'
      }
      primaryAction={
        canManage ? (
          <Button className="min-h-11 md:min-h-9" onClick={onCreate}>
            <Plus aria-hidden="true" />
            New assignment
          </Button>
        ) : undefined
      }
      secondaryActions={
        canManage ? (
          <Button asChild variant="outline" className="min-h-11 md:min-h-9">
            <Link href={`${base}/academics/grading-hub`}>
              <LayoutGrid aria-hidden="true" />
              Grading hub
            </Link>
          </Button>
        ) : undefined
      }
    >
      <StaffAssignments
        assignments={list.data ?? []}
        loading={list.isLoading}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        filters={filters}
        onFiltersChange={setFilters}
        subjects={subjects.data ?? []}
        teachers={teachers.data ?? []}
        grades={grades.data ?? []}
        sections={sections.data ?? []}
        canManage={canManage}
        gradebookHref={`${base}/academics/gradebook`}
        onCreate={onCreate}
        onEdit={onEdit}
      />

      {editing ? (
        <AssignmentForm
          assignment={editing.assignment}
          yearId={year.data?.id ?? ''}
          defaultTeacherId={isTeacher ? user?.id : undefined}
          subjects={subjects.data ?? []}
          teachers={teachers.data ?? []}
          grades={grades.data ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </PageShell>
  );
}
