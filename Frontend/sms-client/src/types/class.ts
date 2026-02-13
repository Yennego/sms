export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id?: string;
  grading_schema_id?: string;
  subject_name?: string;
  teacher_name?: string;
  grading_schema_name?: string;
}

export interface ClassBase {
  name?: string;
  academic_year_id: string;
  description?: string;
  room?: string;
  capacity: number;
  is_active: boolean;
  start_date: string; // ISO date string
  end_date?: string; // ISO date string
  grade_id: string;
  section_id: string;
  class_teacher_id?: string; // Class Sponsor
}

// Make start_date optional for create (backend defaults to today)
export type ClassCreate = Omit<ClassBase, 'start_date'> & { start_date?: string };

export interface ClassUpdate {
  name?: string;
  academic_year_id?: string;
  description?: string;
  room?: string;
  capacity?: number;
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
  grade_id?: string;
  section_id?: string;
  class_teacher_id?: string;
}

export interface Class extends ClassBase {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  // Common display fields included in list responses
  grade_name?: string;
  section_name?: string;
  subject_name?: string;
  academic_year_name?: string;
}

export interface ClassWithDetails extends Class {
  grade_name: string;
  section_name: string;
  academic_year_name?: string;
  class_teacher_name?: string;
  subjects: ClassSubject[];
}

export interface ClassFilters {
  academic_year_id?: string;
  grade_id?: string;
  section_id?: string;
  subject_id?: string;
  teacher_id?: string;
  is_active?: boolean;
  search?: string;
}