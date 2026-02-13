'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import { AcademicYear, Grade, Section, EnrollmentFilters as FilterType } from '@/types/enrollment';

interface EnrollmentFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: FilterType;
  onFilterChange: (key: keyof FilterType, value: string) => void;
  onClearFilters: () => void;
  academicYears: AcademicYear[];
  grades: Grade[];
  sections: Section[];
}

export default function EnrollmentFilters({
  searchTerm,
  setSearchTerm,
  filters,
  onFilterChange,
  onClearFilters,
  academicYears,
  grades,
  sections
}: EnrollmentFiltersProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Filter className="h-5 w-5 mr-2" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="academicYear">Academic Year</Label>
            <Select 
              value={filters.academic_year_id || 'all'} 
              onValueChange={(value) => onFilterChange('academic_year_id', value === 'all' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {academicYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="grade">Grade</Label>
            <Select 
              value={filters.grade_id || 'all'} 
              onValueChange={(value) => onFilterChange('grade_id', value === 'all' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade.id} value={grade.id}>
                    {grade.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="section">Section</Label>
            <Select 
              value={filters.section_id || 'all'} 
              onValueChange={(value) => onFilterChange('section_id', value === 'all' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={filters.status || 'all'} 
              onValueChange={(value) => onFilterChange('status', value === 'all' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}