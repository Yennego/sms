import { CalendarDays, Layers, School, BookOpen, GraduationCap, type LucideIcon } from 'lucide-react';

import type { YearSetup } from '@/services/api/year-setup-service';

export type StepKey = 'terms' | 'levels' | 'classes' | 'subjects' | 'enrollment';

export interface StepInfo {
  key: StepKey;
  title: string;
  short: string;
  description: string;
  icon: LucideIcon;
}

export const STEPS: StepInfo[] = [
  {
    key: 'terms', title: 'Terms', short: 'Terms', icon: CalendarDays,
    description: 'Semesters and periods with their dates.',
  },
  {
    key: 'levels', title: 'Levels and sections', short: 'Levels', icon: Layers,
    description: 'Grade levels and the sections in each one.',
  },
  {
    key: 'classes', title: 'Classes and sponsors', short: 'Classes', icon: School,
    description: 'One class per level and section this year, each with a sponsor.',
  },
  {
    key: 'subjects', title: 'Subjects and teachers', short: 'Subjects', icon: BookOpen,
    description: 'The subjects each level takes, and who teaches them in each class.',
  },
  {
    key: 'enrollment', title: 'Enroll students', short: 'Students', icon: GraduationCap,
    description: 'Put students into this year\'s classes.',
  },
];

export function isStepKey(value: string | null | undefined): value is StepKey {
  return STEPS.some((s) => s.key === value);
}

export function firstIncomplete(data: YearSetup): StepKey | null {
  return STEPS.find((s) => !data.steps[s.key].complete)?.key ?? null;
}

export function completedCount(data: YearSetup): number {
  return STEPS.filter((s) => data.steps[s.key].complete).length;
}
