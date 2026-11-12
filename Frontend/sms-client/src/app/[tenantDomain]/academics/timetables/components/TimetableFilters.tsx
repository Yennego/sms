'use client';

// The staff Timetable page's filters: school year, grade, section and a search box.

import * as React from 'react';
import { Search, X } from 'lucide-react';

import { selectClass } from '@/components/students/admission-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Item = { id: string; name: string };

export interface TimetableFilterValues {
  yearId: string;
  gradeId: string;
  sectionId: string;
  search: string;
}

interface Props {
  years: Item[];
  grades: Item[];
  sections: Item[];
  value: TimetableFilterValues;
  onChange: (next: TimetableFilterValues) => void;
  onClear: () => void;
}

export default function TimetableFilters({ years, grades, sections, value, onChange, onClear }: Props) {
  const set = (patch: Partial<TimetableFilterValues>) => onChange({ ...value, ...patch });
  const filtered = Boolean(value.gradeId || value.sectionId || value.search);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,12rem))_minmax(0,1fr)_auto] lg:items-end">
      <div className="grid gap-2">
        <label htmlFor="tt-year" className="text-sm font-medium">
          School year
        </label>
        <select id="tt-year" className={selectClass} value={value.yearId} onChange={(e) => set({ yearId: e.target.value })}>
          {value.yearId ? null : <option value="">Choose a year</option>}
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <label htmlFor="tt-grade" className="text-sm font-medium">
          Grade
        </label>
        <select
          id="tt-grade"
          className={selectClass}
          value={value.gradeId}
          onChange={(e) => set({ gradeId: e.target.value, sectionId: '' })}
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
        <label htmlFor="tt-section" className="text-sm font-medium">
          Section
        </label>
        <select
          id="tt-section"
          className={selectClass}
          value={value.sectionId}
          onChange={(e) => set({ sectionId: e.target.value })}
          disabled={!value.gradeId}
        >
          <option value="">{value.gradeId ? 'All sections' : 'Choose a grade first'}</option>
          {value.gradeId
            ? sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            : null}
        </select>
      </div>
      <div className="grid gap-2">
        <label htmlFor="tt-search" className="text-sm font-medium">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="tt-search"
            type="search"
            className="h-11 pl-9 text-base md:h-9 md:text-sm"
            placeholder="Timetable name"
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
      </div>
      {filtered ? (
        <Button variant="outline" className="min-h-11 md:min-h-9" onClick={onClear}>
          <X aria-hidden="true" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
