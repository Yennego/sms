'use client';

import React from 'react';
import { Enrollment, AcademicYear } from '@/types/enrollment';

interface Props {
  totalItems: number;
  enrollments: Enrollment[];
  currentAcademicYear: AcademicYear | null;
  gradesCount: number;
}

export default function EnrollmentStatsCards({
  totalItems,
  enrollments,
  currentAcademicYear,
  gradesCount,
}: Props) {
  const activeCount = enrollments.filter(e => e.status === 'active').length;
  const inactiveCount = enrollments.filter(e => e.status !== 'active').length;

  const Card = ({ title, value }: { title: string; value: React.ReactNode }) => (
    <div className="rounded-md border p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card title="Total Enrollments" value={totalItems} />
      <Card title="Current Year" value={currentAcademicYear?.name || '—'} />
      <Card title="Grades" value={gradesCount} />
      <Card title="Active / Other" value={`${activeCount} / ${inactiveCount}`} />
    </div>
  );
}