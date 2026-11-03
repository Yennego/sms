// The school's Users page (GET /auth/users/directory): everyone in this school, paged on the
// server, the office password reset (POST /auth/admin/reset-password/{id}) and new staff accounts
// (GET /auth/staff-roles, POST /auth/staff-accounts).

import { useMemo } from 'react';
import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';

export interface DirectoryUser {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  roles: string[];
  is_active: boolean;
  /** Still on a password the office issued. */
  must_change_password: boolean;
  last_login: string | null;
}

export interface DirectoryPage {
  items: DirectoryUser[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface DirectoryQuery {
  q?: string;
  role?: string;
  status?: 'all' | 'active' | 'inactive';
  page?: number;
  page_size?: number;
}

export interface OfficeResetResult {
  generated_password: string;
  username: string | null;
  email: string | null;
}

/** A role the caller may give a new staff account (admin only for school admins). */
export interface StaffRoleOption {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface StaffAccountCreate {
  first_name: string;
  last_name: string;
  email?: string;
  username?: string;
  phone_number?: string;
  role_id: string;
}

export interface StaffAccountCreated {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  /** Shown once: the password is never stored in readable form or emailed. */
  credentials: { who: string; name: string; username: string; password: string }[];
}

export function useUserDirectoryService() {
  const { apiClient } = useApiClientWithLoading();
  const ready = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      list: async (query: DirectoryQuery): Promise<DirectoryPage> => {
        const client = await ready();
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined && value !== '' && value !== 'all') params.set(key, String(value));
        }
        return client.get<DirectoryPage>(`/auth/users/directory?${params.toString()}`);
      },

      /** Issues a new password to hand over; the user chooses their own at next sign-in. */
      resetPassword: async (userId: string): Promise<OfficeResetResult> => {
        const client = await ready();
        return client.post<OfficeResetResult>(`/auth/admin/reset-password/${userId}`, {});
      },

      staffRoles: async (): Promise<StaffRoleOption[]> => {
        const client = await ready();
        return client.get<StaffRoleOption[]>('/auth/staff-roles');
      },

      /** Creates the account with a generated password; they choose their own at first sign-in. */
      createStaffAccount: async (data: StaffAccountCreate): Promise<StaffAccountCreated> => {
        const client = await ready();
        return client.post<StaffAccountCreated>('/auth/staff-accounts', data);
      },
    }),
    [ready]
  );
}
