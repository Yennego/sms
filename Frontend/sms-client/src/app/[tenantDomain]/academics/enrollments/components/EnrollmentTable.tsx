'use client';

// One server page of enrollments. Desk: a table; phone: cards. Each row's actions sit in a menu.

import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Archive, ArrowRightLeft, ArrowUpCircle, ClipboardList, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { formatDate } from '@/components/students/format';
import { DataTable } from '@/components/ui/data-table';
import { DropdownMenu, type DropdownMenuEntry } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { enrollmentStatusBadge, enrollmentStudent, nameOf, promotionBadge } from '@/components/year-end/format';
import { Enrollment } from '@/types/enrollment';
import { Student } from '@/types/student';

interface Props {
  enrollments: Enrollment[];
  loading: boolean;
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  students: Student[];
  onEdit: (e: Enrollment) => void;
  onPromote: (e: Enrollment) => void;
  onTransfer: (e: Enrollment) => void;
  onArchive: (e: Enrollment) => void;
  onUnarchive: (e: Enrollment) => void;
  onDelete: (e: Enrollment) => void;
  emptyState: React.ReactNode;
}

export default function EnrollmentTable({
  enrollments,
  loading,
  totalItems,
  currentPage,
  itemsPerPage,
  onPageChange,
  onPageSizeChange,
  students,
  onEdit,
  onPromote,
  onTransfer,
  onArchive,
  onUnarchive,
  onDelete,
  emptyState,
}: Props) {
  const columns = React.useMemo<ColumnDef<Enrollment>[]>(
    () => [
      {
        id: 'student',
        header: 'Student',
        enableSorting: false,
        cell: ({ row }) => {
          const s = enrollmentStudent(row.original, students);
          return (
            <div className="min-w-36">
              <p className="font-medium">{s.name}</p>
              {s.admission ? <p className="text-sm text-muted-foreground">{s.admission}</p> : null}
            </div>
          );
        },
      },
      {
        id: 'class',
        header: 'Class',
        enableSorting: false,
        cell: ({ row }) => {
          const e = row.original;
          return (
            <div>
              <p>{[nameOf(e.grade), nameOf(e.section)].filter(Boolean).join(' - ') || '–'}</p>
              <p className="text-sm text-muted-foreground">
                {nameOf(e.academic_year)}
                {` · Semester ${e.semester || 1}`}
              </p>
            </div>
          );
        },
      },
      {
        id: 'date',
        header: 'Enrolled',
        enableSorting: false,
        meta: { hideOnMobile: true },
        cell: ({ row }) => (row.original.enrollment_date ? formatDate(row.original.enrollment_date) : '–'),
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const b = enrollmentStatusBadge(row.original.status);
          return (
            <div className="flex flex-wrap gap-1">
              <StatusBadge status={b.status} label={b.label} />
              {!row.original.is_active ? <StatusBadge status="neutral" icon={Archive} label="Archived" /> : null}
            </div>
          );
        },
      },
      {
        id: 'promotion',
        header: 'Promotion',
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original.promotion_status?.status;
          if (!p) return <span className="text-sm text-muted-foreground">Not checked yet</span>;
          const b = promotionBadge(p);
          return <StatusBadge status={b.status} label={b.label} />;
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => {
          const e = row.original;
          const name = enrollmentStudent(e, students).name;
          const items: DropdownMenuEntry[] = [
            { label: 'Edit enrollment', icon: Pencil, onSelect: () => onEdit(e) },
            { label: 'Promote to a higher grade', icon: ArrowUpCircle, onSelect: () => onPromote(e) },
            { label: 'Transfer out', icon: ArrowRightLeft, onSelect: () => onTransfer(e) },
            e.is_active
              ? { label: 'Archive', icon: Archive, onSelect: () => onArchive(e) }
              : { label: 'Unarchive', icon: RotateCcw, onSelect: () => onUnarchive(e) },
            'separator',
            { label: 'Delete enrollment', icon: Trash2, destructive: true, onSelect: () => onDelete(e) },
          ];
          return (
            <div className="flex justify-end">
              <DropdownMenu label={`Actions for ${name}`} items={items} />
            </div>
          );
        },
      },
    ],
    [students, onEdit, onPromote, onTransfer, onArchive, onUnarchive, onDelete]
  );

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        label="Enrollments"
        columns={columns}
        data={enrollments}
        loading={loading}
        pageSize={0}
        getRowId={(e) => e.id}
        emptyState={emptyState ?? <EmptyState icon={ClipboardList} description="No enrollments match these filters." />}
      />
      {!loading && totalItems > 0 ? (
        <Pagination
          page={currentPage}
          pageSize={itemsPerPage}
          total={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[10, 25, 50]}
          label="Enrollment pages"
          itemLabel="enrollments"
        />
      ) : null}
    </div>
  );
}
