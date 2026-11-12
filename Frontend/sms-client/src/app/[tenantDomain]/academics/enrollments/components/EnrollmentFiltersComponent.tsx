'use client';

// Enrollment filters: search, school year, grade, section (only the chosen grade's), status and
// whether archived enrollments show.

import React from 'react';

import { SearchBox } from '@/components/class-placement/roster-controls';
import { selectClass } from '@/components/students/admission-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ENROLLMENT_STATUSES } from '@/components/year-end/format';
import { AcademicYear, EnrollmentFilters, Grade, Section } from '@/types/enrollment';

interface Props {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filters: EnrollmentFilters;
  onFilterChange: (key: keyof EnrollmentFilters, value: string) => void;
  onClearFilters: () => void;
  academicYears: AcademicYear[];
  grades: Grade[];
  sections: Section[];
}

export default function EnrollmentFiltersComponent({
  searchTerm,
  setSearchTerm,
  filters,
  onFilterChange,
  onClearFilters,
  academicYears,
  grades,
  sections,
}: Props) {
  // Sections belong to a grade: list only the chosen grade's, or name the grade when none is chosen
  const gradeNames = Object.fromEntries(grades.map((g) => [g.id, g.name]));
  const sectionOptions = sections
    .filter((s) => !filters.grade_id || s.grade_id === filters.grade_id)
    .map((s) => ({
      id: s.id,
      label: filters.grade_id || !s.grade_id ? s.name : `${gradeNames[s.grade_id] ?? ''} - ${s.name}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const filtered = Boolean(
    searchTerm || filters.academic_year_id || filters.grade_id || filters.section_id || filters.status || filters.include_archived
  );

  return (
    <section aria-label="Filters" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="Search by student or admission number" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="filter-year">School year</Label>
          <select
            id="filter-year"
            className={selectClass}
            value={filters.academic_year_id ?? ''}
            onChange={(e) => onFilterChange('academic_year_id', e.target.value)}
          >
            <option value="">All years</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.is_current ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="filter-grade">Grade</Label>
          <select
            id="filter-grade"
            className={selectClass}
            value={filters.grade_id ?? ''}
            onChange={(e) => onFilterChange('grade_id', e.target.value)}
          >
            <option value="">All grades</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="filter-section">Section</Label>
          <select
            id="filter-section"
            className={selectClass}
            value={filters.section_id ?? ''}
            onChange={(e) => onFilterChange('section_id', e.target.value)}
          >
            <option value="">All sections</option>
            {sectionOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="filter-status">Status</Label>
          <select
            id="filter-status"
            className={selectClass}
            value={filters.status ?? ''}
            onChange={(e) => onFilterChange('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {ENROLLMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-h-11 items-center gap-3 md:min-h-9">
          <Switch
            id="include-archived"
            checked={filters.include_archived === 'true'}
            onCheckedChange={(v) => onFilterChange('include_archived', v ? 'true' : '')}
          />
          <Label htmlFor="include-archived">Show archived enrollments</Label>
        </div>
        {filtered ? (
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </section>
  );
}
