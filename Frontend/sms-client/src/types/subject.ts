export interface SubjectBase {
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  credits?: number;
}

export type SubjectCreate = SubjectBase;

export interface SubjectUpdate {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
  credits?: number;
}

export interface Subject extends SubjectBase {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface SubjectResponse {
  subjects: Subject[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
