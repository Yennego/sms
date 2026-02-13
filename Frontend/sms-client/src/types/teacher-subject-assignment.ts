export interface TeacherSubjectAssignment {
  id: string;
  tenant_id: string;
  teacher_id: string;
  grade_id: string;
  section_id: string;
  subject_id: string;
  academic_year_id: string;
  room?: string;
  is_active: boolean;
  start_date: string;
  end_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TeacherSubjectAssignmentWithDetails extends TeacherSubjectAssignment {
  teacher_name: string;
  grade_name: string;
  section_name: string;
  subject_name: string;
  class_name: string;
}

export interface ClassSponsor {
  section_id: string;
  section_name: string;
  grade_id: string;
  grade_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  is_assigned: boolean;
}

export interface TeacherWorkload {
  teacher_id: string;
  teacher_name: string;
  total_assignments: number;
  assignments: TeacherSubjectAssignmentWithDetails[];
}

export interface ClassSubjectAssignment {
  id?: string;
  name?: string;
  grade_id: string;
  section_id: string;
  subject_id: string;
  grade_name: string;
  section_name: string;
  subject_name: string;
  class_name: string;
  teacher_id?: string;
  teacher_name?: string;
  is_assigned: boolean;
}

export interface TeacherSubjectAssignmentCreate {
  teacher_id: string;
  grade_id: string;
  section_id: string;
  subject_id: string;
  academic_year_id: string;
  room?: string;
  grading_schema_id?: string;
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

export interface TeacherSubjectAssignmentUpdate {
  teacher_id?: string;
  grade_id?: string;
  section_id?: string;
  subject_id?: string;
  academic_year_id?: string;
  room?: string;
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
  notes?: string;
}