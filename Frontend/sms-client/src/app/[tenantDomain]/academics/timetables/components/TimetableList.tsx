'use client';

// The school's timetables: what each one covers, with view, edit and delete (edit rights only).

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, Eye, Pencil, Trash2 } from 'lucide-react';

import { dayLabel, WEEKDAYS } from '@/components/timetables/timetable-ui';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Timetable } from '@/services/api/timetable-service';

type Item = { id: string; name: string };

/** "Grade 7 - A", or the grade alone for a grade-wide timetable. */
export function timetableClassName(t: Timetable, grades: Item[] = [], sections: Item[] = []): string {
  const grade = t.grade_name || grades.find((g) => g.id === t.grade_id)?.name || 'Unknown grade';
  const section = t.section_name || sections.find((s) => s.id === t.section_id)?.name;
  return section ? `${grade} - ${section}` : grade;
}

function daysOf(t: Timetable): string {
  const used = new Set(t.time_slots.map((s) => (s.day_of_week || '').toLowerCase()));
  return WEEKDAYS.filter((d) => used.has(d))
    .map((d) => dayLabel(d).slice(0, 3))
    .join(', ');
}

interface Props {
  loading: boolean;
  timetables: Timetable[];
  grades: Item[];
  sections: Item[];
  canEdit: boolean;
  /** Shown when the list is empty */
  emptyState: React.ReactNode;
  onView: (t: Timetable) => void;
  onEdit: (t: Timetable) => void;
  onDelete: (t: Timetable) => void;
}

export default function TimetableList({ loading, timetables, grades, sections, canEdit, emptyState, onView, onEdit, onDelete }: Props) {
  const columns = React.useMemo<ColumnDef<Timetable>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Timetable',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.original.name}</span>
            {row.original.is_active ? (
              <StatusBadge status="success" label="Active" />
            ) : (
              <StatusBadge status="neutral" label="Inactive" />
            )}
          </div>
        ),
      },
      {
        id: 'class',
        header: 'Class',
        accessorFn: (t) => timetableClassName(t, grades, sections),
      },
      {
        accessorKey: 'academic_year',
        header: 'School year',
        meta: { hideOnMobile: true },
        cell: ({ row }) => row.original.academic_year || '–',
      },
      {
        id: 'days',
        header: 'Days',
        enableSorting: false,
        meta: { hideOnMobile: true },
        accessorFn: (t) => daysOf(t) || '–',
      },
      {
        id: 'lessons',
        header: 'Lessons',
        accessorFn: (t) => t.time_slots.length,
        meta: { className: 'tabular-nums' },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', className: 'text-right' },
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => onView(row.original)}>
              <Eye aria-hidden="true" />
              View
            </Button>
            {canEdit ? (
              <>
                <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9" onClick={() => onEdit(row.original)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 text-destructive hover:text-destructive md:min-h-9"
                  onClick={() => onDelete(row.original)}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [grades, sections, canEdit, onView, onEdit, onDelete]
  );

  return (
    <DataTable
      label="Timetables"
      columns={columns}
      data={timetables}
      loading={loading}
      getRowId={(t) => t.id}
      emptyState={emptyState ?? <EmptyState icon={CalendarDays} description="No timetables match these filters." />}
    />
  );
}
