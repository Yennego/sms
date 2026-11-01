// School profile: /tenants/self/profile (phase4-design.md section 6). What report cards print about
// the school besides its name and logo (those stay on the school record): address, motto, phone,
// email, the principal and the title under their signature, and an optional school seal.
// Reading and changing it needs manage_tenant_settings; the server answers 403 otherwise.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';
import { fileForm, MULTIPART } from './signature-service';

export interface SchoolProfile {
  address: string | null;
  motto: string | null;
  phone: string | null;
  email: string | null;
  principal_user_id: string | null;
  principal_name: string | null;
  principal_title: string;
  /** data URL of the seal, or null. */
  seal: string | null;
  updated_at: string | null;
}

export interface SchoolProfileUpdate {
  address: string | null;
  motto: string | null;
  phone: string | null;
  email: string | null;
  principal_user_id: string | null;
  principal_title: string;
}

/** A person who can be named principal (active teachers and office staff). */
export interface StaffOption {
  id: string;
  name: string;
  /** "Teacher" or the role name, shown next to the name. */
  kind: string;
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function listOf(resp: unknown): unknown[] {
  if (Array.isArray(resp)) return resp;
  if (isObj(resp)) {
    for (const key of ['items', 'data', 'results', 'users', 'teachers']) {
      if (Array.isArray(resp[key])) return resp[key] as unknown[];
    }
  }
  return [];
}

function personName(o: Obj): string {
  const joined = [str(o.first_name) ?? str(o.firstName), str(o.last_name) ?? str(o.lastName)]
    .filter(Boolean)
    .join(' ')
    .trim();
  return joined || str(o.name) || str(o.full_name) || str(o.username) || str(o.email) || 'Unnamed';
}

function normaliseProfile(resp: unknown): SchoolProfile {
  const o = isObj(resp) ? resp : {};
  const principal = isObj(o.principal) ? o.principal : null;
  const seal = str(o.seal) ?? str(o.seal_image) ?? str(o.seal_url);
  return {
    address: str(o.address),
    motto: str(o.motto),
    phone: str(o.phone),
    email: str(o.email),
    principal_user_id: str(o.principal_user_id) ?? (principal ? str(principal.id) : null),
    principal_name: str(o.principal_name) ?? (principal ? personName(principal) : null),
    principal_title: str(o.principal_title) ?? 'Principal',
    seal,
    updated_at: str(o.updated_at),
  };
}

const NOT_STAFF_ROLES = new Set(['student', 'parent', 'guardian', 'teacher', 'super-admin', 'superadmin', 'super_admin']);
const NOT_STAFF_TYPES = new Set(['student', 'parent', 'guardian']);

export function useSchoolProfileService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      getProfile: async (): Promise<SchoolProfile> => {
        const client = await waitForApiClientReady();
        return normaliseProfile(await client.get<unknown>('/tenants/self/profile'));
      },

      updateProfile: async (update: SchoolProfileUpdate): Promise<SchoolProfile> => {
        const client = await waitForApiClientReady();
        return normaliseProfile(await client.put<unknown>('/tenants/self/profile', update));
      },

      /** PNG or JPEG, at most 1 MB; the server scales it to at most 400 x 400 px. */
      saveSeal: async (file: Blob, filename: string): Promise<void> => {
        const client = await waitForApiClientReady();
        await client.put<unknown>('/tenants/self/profile/seal', fileForm(file, filename), MULTIPART);
      },

      removeSeal: async (): Promise<void> => {
        const client = await waitForApiClientReady();
        await client.delete<unknown>('/tenants/self/profile/seal');
      },

      /**
       * Active teachers (/people/teachers) plus active users holding an office role (every role
       * except student, parent and teacher, via /auth/users?role_id=). Lists the caller can't read
       * are skipped; it fails only when nothing at all could be read.
       */
      listPrincipalCandidates: async (): Promise<StaffOption[]> => {
        const client = await waitForApiClientReady();
        const byId = new Map<string, StaffOption>();
        let anyRead = false;
        let lastError: unknown = null;

        try {
          const teachers = listOf(await client.get<unknown>('/people/teachers?skip=0&limit=1000'));
          anyRead = true;
          for (const raw of teachers) {
            if (!isObj(raw)) continue;
            const id = str(raw.id);
            const inactive = raw.is_active === false || (typeof raw.status === 'string' && raw.status !== 'active');
            if (!id || inactive) continue;
            byId.set(id, { id, name: personName(raw), kind: 'Teacher' });
          }
        } catch (error) {
          lastError = error;
        }

        try {
          const roles = listOf(await client.get<unknown>('/auth/roles'));
          const office = roles.filter(
            (r): r is Obj => isObj(r) && Boolean(str(r.id)) && !NOT_STAFF_ROLES.has(String(r.name ?? '').toLowerCase())
          );
          const lists = await Promise.allSettled(
            office.map(async (role) => ({
              role: str(role.name) ?? 'Staff',
              users: listOf(
                await client.get<unknown>(
                  `/auth/users?is_active=true&limit=500&role_id=${encodeURIComponent(String(role.id))}`
                )
              ),
            }))
          );
          for (const result of lists) {
            if (result.status !== 'fulfilled') {
              lastError = result.reason;
              continue;
            }
            anyRead = true;
            for (const raw of result.value.users) {
              if (!isObj(raw)) continue;
              const id = str(raw.id);
              if (!id || raw.is_active === false || NOT_STAFF_TYPES.has(String(raw.type ?? '').toLowerCase())) continue;
              if (!byId.has(id)) {
                const role = result.value.role;
                byId.set(id, { id, name: personName(raw), kind: role.charAt(0).toUpperCase() + role.slice(1) });
              }
            }
          }
        } catch (error) {
          lastError = error;
        }

        if (!anyRead && lastError) throw lastError;
        return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
      },
    }),
    [waitForApiClientReady]
  );
}
