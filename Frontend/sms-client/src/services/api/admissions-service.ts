// Admissions (docs/remodel/phase3-api.md §2): admit one student with guardian and class in one
// step, find existing guardians, and import a spreadsheet of admissions.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

export type Gender = 'female' | 'male';

export interface AdmissionStudentInput {
  first_name: string;
  last_name: string;
  gender: Gender | null;
  date_of_birth: string | null;
  email: string | null;
  username: string | null;
  admission_number: string | null;
  admission_date: string | null;
  address: string | null;
}

export interface NewGuardianInput {
  existing_id: null;
  first_name: string;
  last_name: string;
  relationship_type: string;
  phone_number: string;
  email: string | null;
  username: string | null;
}

export interface ExistingGuardianInput {
  existing_id: string;
}

export interface AdmissionRequest {
  student: AdmissionStudentInput;
  guardian: NewGuardianInput | ExistingGuardianInput | null;
  class_id: string;
}

export interface AdmissionCredential {
  who: 'student' | 'guardian' | string;
  name: string;
  username: string;
  password: string;
}

export interface AdmissionResponse {
  student: { id: string; name: string; username: string; admission_number: string };
  guardian: { id: string; name: string; username: string; created: boolean } | null;
  enrollment: { id: string; class_id: string; class_name: string; academic_year_id: string };
  credentials: AdmissionCredential[];
}

export interface AddGuardianResponse {
  guardian: { id: string; name: string; username: string; created: boolean };
  /** The new guardian's sign-in, once; empty when an existing guardian was linked. */
  credentials: AdmissionCredential[];
}

export interface GuardianSearchResult {
  id: string;
  name: string;
  username?: string | null;
  email?: string | null;
  phone_number?: string | null;
  children?: string[];
}

/** One spreadsheet row, flat, as the import endpoint expects it. */
export interface AdmissionRow {
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  email: string;
  username: string;
  admission_number: string;
  class_name: string;
  guardian_first_name: string;
  guardian_last_name: string;
  guardian_relationship: string;
  guardian_phone: string;
  guardian_email: string;
}

export const ADMISSION_ROW_FIELDS: (keyof AdmissionRow)[] = [
  'first_name',
  'last_name',
  'gender',
  'date_of_birth',
  'email',
  'username',
  'admission_number',
  'class_name',
  'guardian_first_name',
  'guardian_last_name',
  'guardian_relationship',
  'guardian_phone',
  'guardian_email',
];

export const MAX_IMPORT_ROWS = 500;

export interface ImportRowResult {
  row: number;
  ok: boolean;
  errors: string[];
}

export interface ImportResponse {
  valid: boolean;
  created: number;
  rows: ImportRowResult[];
  credentials: AdmissionCredential[];
}

/** Send empty strings as null so optional fields stay unset on the server. */
function emptyToNull<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    out[key] = typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value;
  }
  return out as T;
}

export function useAdmissionsService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      admit: async (request: AdmissionRequest): Promise<AdmissionResponse> => {
        const client = await waitForApiClientReady();
        const body: AdmissionRequest = {
          student: emptyToNull(request.student),
          guardian:
            request.guardian && 'first_name' in request.guardian
              ? { ...emptyToNull<NewGuardianInput>(request.guardian), existing_id: null }
              : request.guardian,
          class_id: request.class_id,
        };
        return client.post<AdmissionResponse>('/people/admissions', body);
      },

      /** Link a guardian to a student already admitted: an existing one, or a new one with a sign-in. */
      addGuardian: async (studentId: string, guardian: NewGuardianInput | ExistingGuardianInput): Promise<AddGuardianResponse> => {
        const client = await waitForApiClientReady();
        const body = 'first_name' in guardian ? { ...emptyToNull<NewGuardianInput>(guardian), existing_id: null } : guardian;
        return client.post<AddGuardianResponse>(`/people/students/${studentId}/guardians`, body);
      },

      /** Unlink a guardian from a student; the guardian's account is kept. */
      removeGuardian: async (studentId: string, guardianId: string): Promise<void> => {
        const client = await waitForApiClientReady();
        await client.delete(`/people/students/${studentId}/guardians/${guardianId}`);
      },

      searchGuardians: async (q: string): Promise<GuardianSearchResult[]> => {
        const client = await waitForApiClientReady();
        const resp = await client.get<GuardianSearchResult[]>(
          `/people/guardians/search?q=${encodeURIComponent(q)}`
        );
        return Array.isArray(resp) ? resp : [];
      },

      importRows: async (rows: AdmissionRow[], dryRun: boolean): Promise<ImportResponse> => {
        const client = await waitForApiClientReady();
        const resp = await client.post<ImportResponse>('/people/admissions/import', {
          dry_run: dryRun,
          rows: rows.map((r) => emptyToNull(r)),
        });
        return {
          valid: Boolean(resp?.valid),
          created: resp?.created ?? 0,
          rows: Array.isArray(resp?.rows) ? resp.rows : [],
          credentials: Array.isArray(resp?.credentials) ? resp.credentials : [],
        };
      },
    }),
    [waitForApiClientReady]
  );
}
