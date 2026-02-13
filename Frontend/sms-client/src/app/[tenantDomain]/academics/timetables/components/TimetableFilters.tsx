
import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, Search, Plus } from 'lucide-react';
import type { TimetableFilters as TimetableQueryFilters } from '@/services/api/timetable-service';
import type { AcademicYear, Section } from '@/types/enrollment';
import type { AcademicGrade as Grade } from '@/types/academic-grade';

interface Props {
  academicYears: AcademicYear[];
  grades: Grade[];
  sections: Section[];
  filters: TimetableQueryFilters;
  onFiltersChange: (f: TimetableQueryFilters) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onReset: () => void;
  onCreate: () => void;
  isAdmin?: boolean;
}

export default function TimetableFilters({
  academicYears,
  grades,
  sections,
  filters,
  onFiltersChange,
  search,
  onSearchChange,
  onReset,
  onCreate,
  isAdmin,
}: Props) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search timetables..."
            className="pl-8"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {isAdmin && (
          <Button onClick={onCreate} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Create Timetable
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.academic_year_id || ''}
          onValueChange={(value) => onFiltersChange({ ...filters, academic_year_id: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Academic Year" />
          </SelectTrigger>
          <SelectContent>
            {academicYears.map((year) => (
              <SelectItem key={year.id} value={year.id}>
                {year.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.grade_id || ''}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, grade_id: value === '__ALL__' ? '' : value })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All Grades</SelectItem>
            {grades.map((grade) => (
              <SelectItem key={grade.id} value={String(grade.id)}>
                {grade.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.section_id || ''}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, section_id: value === '__ALL__' ? '' : value })
          }
        >
          <SelectTrigger className="w-[180px]" disabled={!filters.grade_id}>
            <SelectValue placeholder="All Sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All Sections</SelectItem>
            {sections.map((section) => (
              <SelectItem key={section.id} value={String(section.id)}>
                {section.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={onReset}>
          <Filter className="w-4 h-4 mr-2" />
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
