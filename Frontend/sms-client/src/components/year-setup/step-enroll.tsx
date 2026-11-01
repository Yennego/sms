'use client';

import Link from 'next/link';
import { ArrowUpRight, FileSpreadsheet, GraduationCap, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { YearSetup } from '@/services/api/year-setup-service';
import { plural } from './use-year-setup';

export interface StepEnrollProps {
  data: YearSetup;
  school: string;
}

export function StepEnroll({ data, school }: StepEnrollProps) {
  const { total, per_class } = data.steps.enrollment;
  const actions = [
    { href: `/${school}/academics/promotion`, label: 'Carry over promoted students', icon: GraduationCap,
      hint: `Move last year's students into ${data.year.name}.` },
    { href: `/${school}/students/new`, label: 'Admit a student', icon: UserPlus, hint: 'Add a new student and put them in a class.' },
    { href: `/${school}/students/import`, label: 'Import a spreadsheet', icon: FileSpreadsheet, hint: 'Add many students at once from a file.' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex min-h-11 items-start gap-3 rounded-xl border p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <a.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium">
                {a.label}
                <ArrowUpRight className="size-3.5 opacity-60" aria-hidden="true" />
              </span>
              <span className="block text-sm text-muted-foreground">{a.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="text-sm font-medium">
        {total === 0 ? 'No students enrolled in this year yet.' : `${plural(total, 'student')} enrolled in ${data.year.name}.`}
      </p>

      {per_class.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {per_class.map((c) => {
            const full = c.capacity > 0 && c.count >= c.capacity;
            const pct = c.capacity > 0 ? Math.min(100, Math.round((c.count / c.capacity) * 100)) : 0;
            return (
              <li key={c.class_id} className="grid gap-2 p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-center sm:gap-4">
                <span className="text-sm font-medium">{c.class_name}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className={full ? 'h-full bg-orange-500' : 'h-full bg-primary'} style={{ width: `${pct}%` }} />
                </div>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {c.count} of {c.capacity}
                  {full ? <StatusBadge status="warning" label="Full" /> : c.count === 0 ? <StatusBadge status="neutral" label="Empty" /> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Classes appear here once they are created in step 3.</p>
      )}

      <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
        <Link href={`/${school}/academics/enrollments`}>See all enrollments</Link>
      </Button>
    </div>
  );
}
