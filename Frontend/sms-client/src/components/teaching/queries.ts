'use client';

// TanStack Query hooks for what a teacher teaches and what a student takes: the teacher's subject
// loads and their students, the student's current class and its subjects. Keys start with the school.
import { useQuery } from '@tanstack/react-query';

import { useSchoolKey } from '@/components/students/queries';
import { useClassService } from '@/services/api/class-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useTeacherService } from '@/services/api/teacher-service';
import type { Enrollment } from '@/types/enrollment';

export const teachingKeys = {
  all: (school: string | null) => ['teaching', school] as const,
  loads: (school: string | null, teacherId: string) => [...teachingKeys.all(school), 'loads', teacherId] as const,
  loadStudents: (school: string | null, loadId: string) => [...teachingKeys.all(school), 'load-students', loadId] as const,
  enrollment: (school: string | null, studentId: string) => [...teachingKeys.all(school), 'enrollment', studentId] as const,
  courses: (school: string | null, enrollmentId: string) => [...teachingKeys.all(school), 'courses', enrollmentId] as const,
};

/** One subject a teacher teaches in one class. */
export interface SubjectLoad {
  /** The subject assignment (unique per card; timetable slots point at it) */
  id: string;
  /** The class; daily attendance is taken per class */
  classId: string;
  subject: string;
  className: string;
}

export interface LoadStudent {
  id: string;
  name: string;
  admissionNo: string;
}

interface RawLoad {
  id: string;
  class_id: string;
  subject_name?: string;
  class_name?: string;
  grade_name?: string;
  section_name?: string;
}

interface RawLoadStudent {
  id?: string;
  student_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  admission_number?: string;
}

export function useTeacherLoads(teacherId: string) {
  const { getTeacherAssignments } = useTeacherService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: teachingKeys.loads(school, teacherId),
    queryFn: async (): Promise<SubjectLoad[]> => {
      const rows = (await getTeacherAssignments(teacherId)) as RawLoad[];
      return rows
        .map((r) => ({
          id: r.id,
          classId: r.class_id,
          subject: r.subject_name || r.class_name || 'Subject',
          className: [r.grade_name, r.section_name].filter(Boolean).join(' - ') || r.class_name || 'Class',
        }))
        .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || a.subject.localeCompare(b.subject));
    },
    enabled: Boolean(school && teacherId),
  });
}

export function useLoadStudents(loadId: string | null) {
  const { getAssignmentStudents } = useTeacherService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: teachingKeys.loadStudents(school, loadId ?? ''),
    queryFn: async (): Promise<LoadStudent[]> => {
      const rows = (await getAssignmentStudents(loadId as string)) as RawLoadStudent[];
      return rows
        .map((s) => ({
          id: s.student_id || s.id || '',
          name: s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || 'Unnamed',
          admissionNo: s.admission_number || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(school && loadId),
  });
}

/** The signed-in student's current enrollment (null when they aren't in a class this year). */
export function useMyEnrollment(studentId: string, enabled = true) {
  const { getCurrentEnrollment } = useEnrollmentService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: teachingKeys.enrollment(school, studentId),
    queryFn: () => getCurrentEnrollment(studentId),
    enabled: Boolean(school && studentId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** "Grade 7 - A" for an enrollment. */
export function enrollmentLabel(e?: Enrollment | null): string {
  if (!e) return '';
  const name = (v: unknown) => (typeof v === 'string' ? v : (v as { name?: string } | undefined)?.name ?? '');
  return [name(e.grade), name(e.section)].filter(Boolean).join(' - ');
}

export interface Course {
  id: string;
  subject: string;
  teacher: string;
}

/** The subjects of the student's class (every active class of their grade, section and year). */
export function useMyCourses(enrollment: Enrollment | null | undefined) {
  const { getClasses, getClassWithDetails } = useClassService();
  const school = useSchoolKey();
  return useQuery({
    queryKey: teachingKeys.courses(school, enrollment?.id ?? ''),
    queryFn: async (): Promise<Course[]> => {
      const e = enrollment as Enrollment;
      const classes = await getClasses({
        grade_id: e.grade_id,
        section_id: e.section_id,
        academic_year_id: e.academic_year_id,
        is_active: true,
      });
      const details = await Promise.all(classes.map((c) => getClassWithDetails(c.id)));
      return details
        .flatMap((d) => d?.subjects ?? [])
        .map((s) => ({ id: s.id, subject: s.subject_name || 'Subject', teacher: s.teacher_name || '' }))
        .sort((a, b) => a.subject.localeCompare(b.subject));
    },
    enabled: Boolean(school && enrollment?.id),
  });
}
