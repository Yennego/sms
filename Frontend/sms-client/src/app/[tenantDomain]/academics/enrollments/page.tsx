'use client';

// Enrollments: every student's place in a class, year by year, one server page at a time. Office
// staff filter by year, grade, section and status, enroll students one by one or from a file, and
// edit, promote, transfer, archive or delete an enrollment. Admins only.

import React, { useCallback, useRef, useState } from 'react';
import { ClipboardList, Download, Lock, SearchX } from 'lucide-react';

import PermissionGuard from '@/components/auth/permission-guard';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { notify } from '@/components/ui/toaster';
import { enrollmentStudent, nameOf } from '@/components/year-end/format';
import {
  useAllSections,
  useCurrentSchoolYear,
  useDeleteEnrollment,
  useEnrollmentList,
  useGradeLevels,
  useSchoolYears,
  useStudentChoices,
  useUpdateEnrollment,
} from '@/components/year-end/queries';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useDebounce } from '@/hooks/use-debounce';
import { Enrollment, EnrollmentFilters } from '@/types/enrollment';
import { Student } from '@/types/student';
import EnrollmentDialogs, { type EnrollmentDialogsHandle } from './components/EnrollmentDialogs';
import EnrollmentFiltersComponent from './components/EnrollmentFiltersComponent';
import EnrollmentTable from './components/EnrollmentTable';

const NO_STUDENTS: Student[] = [];

export default function EnrollmentManagementPage() {
  return (
    // The admin and the principal (manage_enrollment, like the server checks); the menu shows it to both
    <PermissionGuard
      requiredPermissions={['manage_enrollment']}
      fallback={
        <PageShell title="Enrollments">
          <EmptyState icon={Lock} description="Only staff who manage enrollments can open this page." />
        </PageShell>
      }
    >
      <EnrollmentsView />
    </PermissionGuard>
  );
}

function EnrollmentsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [filters, setFilters] = useState<EnrollmentFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { setSelectedAcademicYearId } = useAcademicYear();

  const list = useEnrollmentList((currentPage - 1) * itemsPerPage, itemsPerPage, {
    ...filters,
    search: debouncedSearch,
    include_archived: filters.include_archived,
  });
  const studentsQuery = useStudentChoices();
  const students = (studentsQuery.data?.items as Student[] | undefined) ?? NO_STUDENTS;
  const { data: academicYears = [] } = useSchoolYears();
  const { data: grades = [] } = useGradeLevels();
  const { data: sections = [] } = useAllSections();
  const { data: currentAcademicYear = null } = useCurrentSchoolYear();

  const enrollments = list.data?.items ?? [];
  const totalItems = list.data?.total ?? 0;

  const deleteMutation = useDeleteEnrollment();
  const updateMutation = useUpdateEnrollment();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [archiving, setArchiving] = useState<{ enrollment: Enrollment; active: boolean } | null>(null);
  const [deleting, setDeleting] = useState<Enrollment | null>(null);
  const dialogsRef = useRef<EnrollmentDialogsHandle | null>(null);

  const nameOfEnrollment = (e: Enrollment) => enrollmentStudent(e, students).name;
  const classOfEnrollment = (e: Enrollment) =>
    [nameOf(e.grade), nameOf(e.section)].filter(Boolean).join(' - ') +
    (nameOf(e.academic_year) ? `, ${nameOf(e.academic_year)}` : '');

  const confirmArchive = async () => {
    if (!archiving) return;
    const { enrollment, active } = archiving;
    try {
      await updateMutation.mutateAsync({ id: enrollment.id, data: { is_active: active } });
      notify.success(active ? 'Enrollment unarchived.' : 'Enrollment archived.');
    } catch (error) {
      notify.error(
        errorMessage(error, active ? "The enrollment wasn't unarchived. Try again." : "The enrollment wasn't archived. Try again.")
      );
    }
    setArchiving(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      notify.success('Enrollment deleted.');
    } catch (error) {
      notify.error(errorMessage(error, "The enrollment wasn't deleted. Try again."));
      throw error;
    }
  };

  const onEdit = useCallback((e: Enrollment) => setEditingEnrollment(e), []);
  const onPromote = useCallback((e: Enrollment) => dialogsRef.current?.setPromoteEnrollment(e), []);
  const onTransfer = useCallback((e: Enrollment) => dialogsRef.current?.setTransferEnrollment(e), []);
  const onArchive = useCallback((e: Enrollment) => setArchiving({ enrollment: e, active: false }), []);
  const onUnarchive = useCallback((e: Enrollment) => setArchiving({ enrollment: e, active: true }), []);
  const onDelete = useCallback((e: Enrollment) => setDeleting(e), []);

  const handleSuccess = () => {
    setEditingEnrollment(null);
    setShowCreateDialog(false);
    setShowBulkDialog(false);
  };

  const handleFilterChange = (key: keyof EnrollmentFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      if (key === 'grade_id') delete next.section_id; // the section belongs to the old grade
      return next;
    });
    if (key === 'academic_year_id') setSelectedAcademicYearId(value || '');
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setSelectedAcademicYearId('');
    setCurrentPage(1);
  };

  const exportEnrollments = () => {
    const headers = [
      'Student Name', 'Admission Number', 'Academic Year', 'Grade', 'Section', 'Semester', 'Enrollment Date', 'Status', 'Active',
    ];
    const rows = enrollments.map((e) => {
      const student = e.student || students.find((s) => s.id === e.student_id);
      const studentName = student ? `${student.firstName} ${student.lastName}` : '';
      const admissionNumber = student ? (student.admission_number ?? '') : '';
      const enrollmentDate = e.enrollment_date ? e.enrollment_date.split('T')[0] : '';
      return [
        studentName,
        admissionNumber,
        nameOf(e.academic_year),
        nameOf(e.grade),
        nameOf(e.section),
        e.semester ?? '1',
        enrollmentDate,
        e.status,
        e.is_active ? 'Yes' : 'No',
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrollments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = Boolean(searchTerm || Object.keys(filters).length);

  return (
    <PageShell
      title="Enrollments"
      description={
        currentAcademicYear
          ? `Which class each student is in, year by year. The current school year is ${currentAcademicYear.name}.`
          : 'Which class each student is in, year by year.'
      }
      secondaryActions={
        <>
          <Button
            variant="outline"
            className="min-h-11 md:min-h-9"
            onClick={exportEnrollments}
            disabled={enrollments.length === 0}
          >
            <Download aria-hidden="true" />
            Download this page (CSV)
          </Button>
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setShowBulkDialog(true)}>
            Enroll from a file
          </Button>
        </>
      }
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={() => setShowCreateDialog(true)}>
          Enroll a student
        </Button>
      }
    >
      <EnrollmentFiltersComponent
        searchTerm={searchTerm}
        setSearchTerm={handleSearchChange}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
        academicYears={academicYears}
        grades={grades}
        sections={sections}
      />

      {list.isError ? (
        <EmptyState
          icon={ClipboardList}
          title="The enrollments didn't load"
          description={`${errorMessage(list.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <EnrollmentTable
          enrollments={enrollments}
          loading={list.isLoading}
          totalItems={totalItems}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setItemsPerPage(size);
            setCurrentPage(1);
          }}
          students={students}
          onEdit={onEdit}
          onPromote={onPromote}
          onTransfer={onTransfer}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
          emptyState={
            filtered ? (
              <EmptyState
                icon={SearchX}
                description="No enrollments match these filters. Change or clear the filters."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ClipboardList}
                description="No students are enrolled yet. Enroll a student to put them in a class."
                action={<Button onClick={() => setShowCreateDialog(true)}>Enroll a student</Button>}
              />
            )
          }
        />
      )}

      <EnrollmentDialogs
        ref={dialogsRef}
        hideButtons
        showCreateDialog={showCreateDialog}
        setShowCreateDialog={setShowCreateDialog}
        showBulkDialog={showBulkDialog}
        setShowBulkDialog={setShowBulkDialog}
        editingEnrollment={editingEnrollment}
        setEditingEnrollment={setEditingEnrollment}
        students={students}
        academicYears={academicYears}
        grades={grades}
        sections={sections}
        currentAcademicYear={currentAcademicYear}
        onSuccess={handleSuccess}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={
          archiving
            ? `${archiving.active ? 'Unarchive' : 'Archive'} ${nameOfEnrollment(archiving.enrollment)}'s enrollment?`
            : ''
        }
        description={
          archiving?.active
            ? 'It shows in the enrollment lists again.'
            : 'It is hidden from the enrollment lists. Turn on "Show archived enrollments" to see it again.'
        }
        confirmLabel={archiving?.active ? 'Unarchive enrollment' : 'Archive enrollment'}
        loading={updateMutation.isPending}
        onConfirm={confirmArchive}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        destructive
        title={deleting ? `Delete ${nameOfEnrollment(deleting)}'s enrollment?` : ''}
        description={
          deleting
            ? `Their enrollment in ${classOfEnrollment(deleting) || 'this class'} is deleted. This can't be undone. To only hide it, archive it instead.`
            : undefined
        }
        confirmLabel="Delete enrollment"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}
