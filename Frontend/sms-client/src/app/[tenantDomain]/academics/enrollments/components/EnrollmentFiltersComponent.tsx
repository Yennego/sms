'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnrollmentFilters, AcademicYear, Grade, Section } from '@/types/enrollment';
import { Switch } from '@/components/ui/switch';

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
  return (
    <div className="rounded-md border p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student or admission number"
          />
        </div>

        {/* Academic Year */}
        <div>
          <Label>Academic Year</Label>
          <Select
            value={filters.academic_year_id ?? '__all__'}
            onValueChange={(v) => onFilterChange('academic_year_id', v === '__all__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {academicYears.map(y => (
                <SelectItem key={y.id} value={y.id}>
                  {y.name} {y.is_current && '(Current)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grade */}
        <div>
          <Label>Grade</Label>
          <Select
            value={filters.grade_id ?? '__all__'}
            onValueChange={(v) => onFilterChange('grade_id', v === '__all__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {grades.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section */}
        <div>
          <Label>Section</Label>
          <Select
            value={filters.section_id ?? '__all__'}
            onValueChange={(v) => onFilterChange('section_id', v === '__all__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div>
          <Label>Status</Label>
          <Select
            value={filters.status ?? '__all__'}
            onValueChange={(v) => onFilterChange('status', v === '__all__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
              <SelectItem value="graduated">Graduated</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Label htmlFor="include-archived">Show archived</Label>
          <Switch
            id="include-archived"
            checked={filters.include_archived === 'true'}
            onCheckedChange={(v) => onFilterChange('include_archived', v ? 'true' : '')}
          />
        </div>
        <Button variant="outline" onClick={onClearFilters}>Clear</Button>
      </div>
    </div>
  );
}