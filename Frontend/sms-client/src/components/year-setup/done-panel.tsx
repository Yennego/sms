'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, CreditCard, IdCard, ListChecks } from 'lucide-react';

import type { YearSetup } from '@/services/api/year-setup-service';
import { plural } from './use-year-setup';

export interface DonePanelProps {
  data: YearSetup;
  school: string;
}

/** Shown when every step is complete: what exists, and what is usually set up next. */
export function DonePanel({ data, school }: DonePanelProps) {
  const { terms, levels, classes, subjects, enrollment } = data.steps;
  const periods = terms.semesters.reduce((n, s) => n + s.periods.length, 0);
  const sections = levels.levels.reduce((n, l) => n + l.sections.length, 0);
  const classSubjects = subjects.classes.reduce((n, c) => n + c.subjects.length, 0);

  const facts = [
    `${plural(terms.semesters.length, 'semester')} with ${plural(periods, 'period')}`,
    `${plural(levels.levels.length, 'grade level')} with ${plural(sections, 'section')}`,
    `${plural(classes.classes.length, 'class', 'classes')}, each with a sponsor`,
    `${plural(classSubjects, 'class subject')}, each with a teacher`,
    `${plural(enrollment.total, 'student')} enrolled`,
  ];

  const next = [
    { href: `/${school}/academics/grading-schemas`, label: 'Set up the grading schema', hint: 'How tests, quizzes and exams count towards grades.', icon: ListChecks },
    { href: `/${school}/finance/structures`, label: 'Set up fees', hint: 'Fee amounts and due dates for this year.', icon: CreditCard },
    { href: `/${school}/attendance/id-cards`, label: 'Print ID cards', hint: 'Student cards for gate scanning.', icon: IdCard },
  ];

  return (
    <section className="space-y-6 rounded-xl border border-green-200 bg-green-50/50 p-4 sm:p-6" aria-labelledby="setup-done-title">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green-700" aria-hidden="true" />
        <div>
          <h2 id="setup-done-title" className="text-lg font-semibold">{data.year.name} is set up</h2>
          <p className="text-sm text-muted-foreground">Here is what this year has. You can still change any step above.</p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {facts.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-green-700" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Next steps</h3>
        <ul className="grid gap-2 sm:grid-cols-3">
          {next.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                className="flex min-h-11 items-start gap-3 rounded-xl border bg-background p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <n.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {n.label}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="block text-sm text-muted-foreground">{n.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
