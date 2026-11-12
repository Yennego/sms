'use client';

// Shared pieces of Assignments: who may set them, and the status badges (colour plus text).

import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import type { Assignment } from '@/services/api/assignment-service';
import type { Submission } from '@/services/api/submission-service';

const MANAGER_ROLES = ['admin', 'teacher', 'superadmin'];

/**
 * What the signed-in person does here (the server decides; this only shapes the screen): teachers
 * and admins set, publish and mark assignments; students see their class's and hand work in;
 * anyone else (e.g. the principal) reads the list.
 */
export function useAssignmentsAccess() {
  const { user, isLoading } = useAuth();
  const role = (user?.role || '').toLowerCase().replace(/[-_]/g, '');
  return {
    user,
    isLoading,
    isStudent: role === 'student',
    canManage: MANAGER_ROLES.includes(role),
    isTeacher: role === 'teacher',
  };
}

export function PublishedBadge({ assignment }: { assignment: Pick<Assignment, 'is_published'> }) {
  return assignment.is_published ? (
    <StatusBadge status="success" label="Published" />
  ) : (
    <StatusBadge status="neutral" label="Draft" />
  );
}

/** A mark, once the teacher has given one. */
export function isMarked(sub?: Submission | null): boolean {
  return Boolean(sub && (sub.status?.toUpperCase() === 'GRADED' || (sub.score !== undefined && sub.score !== null)));
}

/** Where the student stands with one assignment. */
export function WorkBadge({ submission, due, today }: { submission?: Submission; due: string; today: string }) {
  if (isMarked(submission)) return <StatusBadge status="success" label="Marked" />;
  if (submission) return <StatusBadge status="info" label="Handed in" />;
  if (due && due.slice(0, 10) < today) return <StatusBadge status="danger" label="Past due" />;
  return <StatusBadge status="pending" label="To do" />;
}
