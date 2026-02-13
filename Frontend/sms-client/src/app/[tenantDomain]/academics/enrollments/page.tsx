'use client';

import React, { useState, useRef } from 'react';
import { Enrollment, EnrollmentFilters } from '@/types/enrollment';
import PermissionGuard from '@/components/auth/permission-guard';
import { useTenant } from '@/hooks/use-tenant';
import EnrollmentDialogs from './components/EnrollmentDialogs';
import EnrollmentStatsCards from './components/EnrollmentStatsCards';
import EnrollmentFiltersComponent from './components/EnrollmentFiltersComponent';
import EnrollmentTable from './components/EnrollmentTable';
import { toast } from 'sonner';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { Button } from '@/components/ui/button';
import {
  useEnrollments,
  useEnrollmentGrades,
  useEnrollmentSections,
  useAcademicYears,
  useCurrentAcademicYear,
  useDeleteEnrollment,
  useUpdateEnrollment
} from '@/hooks/queries/enrollments';
import { useStudentsPaged } from '@/hooks/queries/students';
import { useDebounce } from '@/hooks/use-debounce';

export default function EnrollmentManagementPage() {
  // State management for filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [filters, setFilters] = useState<EnrollmentFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { tenant } = useTenant();
  const { setSelectedAcademicYearId } = useAcademicYear();

  // Queries using TanStack Query
  const { data: enrollmentData, isLoading: enrollmentsLoading } = useEnrollments(
    (currentPage - 1) * itemsPerPage,
    itemsPerPage,
    { ...filters, search: debouncedSearch, include_archived: filters.include_archived }
  );

  // Load auxiliary data with TanStack query caching
  const { data: students = [] } = useStudentsPaged(0, 1000);
  const { data: academicYears = [] } = useAcademicYears();
  const { data: grades = [] } = useEnrollmentGrades();
  const { data: sections = [] } = useEnrollmentSections();
  const { data: currentAcademicYear = null } = useCurrentAcademicYear();

  const enrollments = enrollmentData?.items || [];
  const totalItems = enrollmentData?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Mutations
  const deleteMutation = useDeleteEnrollment();
  const updateMutation = useUpdateEnrollment();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const dialogsRef = useRef<{ setTransferEnrollment: (e: Enrollment | null) => void; setPromoteEnrollment: (e: Enrollment | null) => void } | null>(null);

  const handleArchive = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, data: { is_active: false } });
      toast.success('Enrollment archived');
    } catch (error) {
      toast.error('Failed to archive enrollment');
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, data: { is_active: true } });
      toast.success('Enrollment unarchived');
    } catch (error) {
      toast.error('Failed to unarchive enrollment');
    }
  };

  const handleDeleteEnrollment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this enrollment?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Enrollment deleted');
    } catch (error) {
      toast.error('Failed to delete enrollment');
    }
  };

  const handleTransfer = (e: Enrollment) => {
    dialogsRef.current?.setTransferEnrollment(e);
  };

  const handlePromote = (e: Enrollment) => {
    dialogsRef.current?.setPromoteEnrollment(e);
  };

  const handleSuccess = () => {
    setEditingEnrollment(null);
    setShowCreateDialog(false);
    setShowBulkDialog(false);
    toast.success('Operation successful');
  };

  const handleFilterChange = (key: keyof EnrollmentFilters, value: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
    if (key === 'academic_year_id') {
      setSelectedAcademicYearId(value || '');
    }
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
      // Use nested student data if available, fallback to lookup
      const student = e.student || students.find((s: any) => s.id === e.student_id);
      const studentName = student ? (`${student.firstName} ${student.lastName}`) : '';
      const admissionNumber = student ? (student.admission_number ?? '') : '';
      const academicYearLabel = typeof e.academic_year === 'string' ? e.academic_year : (e.academic_year?.name ?? '');
      const gradeLabel = typeof e.grade === 'string' ? e.grade : (e.grade?.name ?? '');
      const sectionLabel = typeof e.section === 'string' ? e.section : (e.section?.name ?? '');
      const enrollmentDate = e.enrollment_date ? e.enrollment_date.split('T')[0] : '';
      const active = e.is_active ? 'Yes' : 'No';
      return [
        studentName, admissionNumber, academicYearLabel, gradeLabel, sectionLabel, e.semester ?? '1', enrollmentDate, e.status, active,
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

  return (
    <PermissionGuard requiredRole="admin" fallback={<div>Access denied</div>}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Enrollment Management</h1>
            <p className="text-muted-foreground">Manage student enrollments across academic years, grades, and sections</p>
          </div>
          <div className="flex gap-2 items-center">
            <PermissionGuard requiredRole="admin">
              <Button variant="outline" onClick={exportEnrollments}>Export CSV</Button>
            </PermissionGuard>
            <EnrollmentDialogs
              ref={dialogsRef}
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
          </div>
        </div>

        <EnrollmentStatsCards
          totalItems={totalItems}
          enrollments={enrollments}
          currentAcademicYear={currentAcademicYear}
          gradesCount={grades.length}
        />
        <EnrollmentFiltersComponent
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
          academicYears={academicYears} // Pass the fetched academic years
          grades={grades}
          sections={sections}
        />

        <EnrollmentTable
          enrollments={enrollments}
          loading={enrollmentsLoading}
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onEdit={setEditingEnrollment}
          onDelete={handleDeleteEnrollment}
          onPageChange={setCurrentPage}
          students={students}
          onTransfer={handleTransfer}
          onPromote={handlePromote}
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
        />
      </div>
    </PermissionGuard>
  );
}
