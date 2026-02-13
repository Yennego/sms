export interface SectionBase {
  name: string;
  grade_id: string;
  capacity?: number;
  description?: string;
}


export type SectionCreate = SectionBase;

export type SectionUpdate = Partial<SectionBase>;

export interface Section extends SectionBase {
  id: string;
  grade_name: string;
  created_at: string;
  updated_at: string;
}

export interface SectionWithDetails extends Section {
  student_count?: number;
  class_count?: number;
}

export interface SectionResponse {
  sections: Section[];
  total: number;
  page: number;
  size: number;
  pages: number;
}