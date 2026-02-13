export interface AcademicGradeBase {
  name: string;
  description?: string;
  is_active: boolean;
  sequence: number;
  age_range?: string;
}

export type AcademicGradeCreate = AcademicGradeBase;

export interface AcademicGradeUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
  sequence?: number;
  age_range?: string;
}

export interface AcademicGrade extends AcademicGradeBase {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface AcademicGradeResponse {
  grades: AcademicGrade[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
