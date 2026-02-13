export type UUID = string;

export type GradeType =
  | 'ASSIGNMENT'
  | 'QUIZ'
  | 'TEST'
  | 'EXAM'
  | 'PROJECT'
  | 'PARTICIPATION'
  | 'ATTENDANCE'
  | 'OTHER';

export interface GradeBase {
  student_id: UUID;
  enrollment_id: UUID;
  subject_id: UUID;
  assessment_type: GradeType;
  assessment_id?: UUID | null;
  assessment_name: string;
  assessment_date: string; // ISO date
  score: number;
  max_score: number;
  percentage: number; // 0..100
  letter_grade?: string | null;
  comments?: string | null;
  graded_by: UUID;
}

export interface GradeCreate extends GradeBase {
  graded_date?: string; // ISO date (defaults server-side)
}

export interface GradeUpdate {
  score?: number;
  max_score?: number;
  percentage?: number;
  letter_grade?: string | null;
  comments?: string | null;
  graded_by?: UUID;
  graded_date?: string;
}

export interface Grade extends GradeBase {
  id: UUID;
  tenant_id: UUID;
  graded_date: string;
  created_at: string;
  updated_at: string;
}

export interface GradeWithDetails extends Grade {
  student_name: string;
  subject_name: string;
  teacher_name: string;
}