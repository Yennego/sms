export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  total_students?: number;
  total_classes?: number;
}

export interface AcademicYearCreate {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export interface AcademicYearUpdate {
  name?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface Grade {
  id: string;
  name: string;
  level: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  name: string;
  capacity?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentMinimal {
  id: string;
  firstName: string;
  lastName: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  admission_number?: string;
}

export interface PromotionStatusMinimal {
  id: string;
  status: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  academic_year_id: string;
  grade_id: string;
  section_id: string;
  semester?: number;
  enrollment_date: string;
  status: 'active' | 'inactive' | 'transferred' | 'graduated' | 'withdrawn';
  created_at: string;
  updated_at: string;

  // Populated fields or raw strings from backend
  student?: StudentMinimal;
  promotion_status?: PromotionStatusMinimal;
  academic_year?: AcademicYear | string;
  grade?: Grade | string;
  section?: Section | string;
  is_active: boolean;
}

export interface EnrollmentCreate {
  student_id: string;
  academic_year?: string;
  grade?: string;
  section?: string;
  academic_year_id?: string;
  grade_id?: string;
  section_id?: string;
  class_id?: string;
  semester?: number;
  enrollment_date: string;
  status?: 'active' | 'inactive';
}

export interface EnrollmentUpdate {
  academic_year?: string;
  grade?: string;
  section?: string;
  academic_year_id?: string;
  grade_id?: string;
  section_id?: string;
  semester?: number;
  enrollment_date?: string;
  status?: 'active' | 'inactive' | 'transferred' | 'graduated' | 'withdrawn';
  is_active?: boolean;
}

export interface BulkEnrollmentCreate {
  student_ids: string[];
  academic_year_id: string;
  grade_id: string;
  section_id: string;
  semester?: number;
  enrollment_date: string;
}

export interface EnrollmentFilters {
  academic_year_id?: string;
  grade_id?: string;
  section_id?: string;
  status?: string;
  search?: string;
  include_archived?: string; // 'true' to include archived
}

export interface PaginatedEnrollments {
  items: Enrollment[];
  total: number;
  skip: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}