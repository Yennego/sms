'use client';

// School year picker for the results screens. Defaults to the current year; the choice is kept
// in ?year= so a reload or a shared link shows the same year.
import * as React from 'react';

import { useAcademicYearsList, useCurrentAcademicYearDetail } from '@/hooks/queries/academic-years';
import type { AcademicYear } from '@/types/enrollment';

import { useUrlParam } from './use-url-param';

export interface ResultYears {
  years: AcademicYear[];
  yearId: string | undefined;
  setYearId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useResultYears(): ResultYears {
  const listQuery = useAcademicYearsList(true);
  const currentQuery = useCurrentAcademicYearDetail();
  const [yearParam, setYearParam] = useUrlParam('year');

  const years = React.useMemo(() => {
    const list = Array.isArray(listQuery.data) ? [...listQuery.data] : [];
    const current = currentQuery.data;
    if (current && !list.some((y) => y.id === current.id)) list.push(current);
    // Newest first.
    return list.sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
  }, [listQuery.data, currentQuery.data]);

  const fallback = currentQuery.data?.id ?? years.find((y) => y.is_current)?.id ?? years[0]?.id;
  const yearId = years.some((y) => y.id === yearParam) ? yearParam : fallback;

  const isLoading = (listQuery.isLoading || currentQuery.isLoading) && years.length === 0;
  const isError = listQuery.isError && currentQuery.isError && years.length === 0;
  const { refetch: refetchList } = listQuery;
  const { refetch: refetchCurrent } = currentQuery;
  const refetch = React.useCallback(() => {
    void refetchList();
    void refetchCurrent();
  }, [refetchList, refetchCurrent]);

  return { years, yearId, setYearId: (id) => setYearParam(id), isLoading, isError, refetch };
}

export interface YearSelectProps {
  years: AcademicYear[];
  value: string | undefined;
  onChange: (id: string) => void;
}

export function YearSelect({ years, value, onChange }: YearSelectProps) {
  const id = React.useId();
  if (years.length <= 1) {
    const only = years[0];
    return only ? <p className="text-sm text-muted-foreground">School year: {only.name}</p> : null;
  }
  return (
    <div className="flex w-full flex-col gap-1 sm:w-64">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        School year
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
            {y.is_current ? ' (this year)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
