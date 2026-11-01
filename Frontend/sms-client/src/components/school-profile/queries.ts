// TanStack Query hooks for the school profile. Every key starts with the school.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTenant } from '@/hooks/use-tenant';
import { useSchoolProfileService, type SchoolProfileUpdate } from '@/services/api/school-profile-service';

export const schoolProfileKeys = {
  all: (school: string | null) => ['school-profile', school] as const,
  profile: (school: string | null) => [...schoolProfileKeys.all(school), 'profile'] as const,
  staff: (school: string | null) => [...schoolProfileKeys.all(school), 'principal-candidates'] as const,
};

function noRetryOnDenied(count: number, error: unknown) {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return status !== 401 && status !== 403 && status !== 404 && count < 2;
}

export function useSchoolProfile() {
  const service = useSchoolProfileService();
  const { tenantKey } = useTenant();
  return useQuery({
    queryKey: schoolProfileKeys.profile(tenantKey),
    queryFn: () => service.getProfile(),
    enabled: Boolean(tenantKey),
    retry: noRetryOnDenied,
  });
}

export function usePrincipalCandidates(enabled: boolean) {
  const service = useSchoolProfileService();
  const { tenantKey } = useTenant();
  return useQuery({
    queryKey: schoolProfileKeys.staff(tenantKey),
    queryFn: () => service.listPrincipalCandidates(),
    enabled: Boolean(tenantKey) && enabled,
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnDenied,
  });
}

export function useUpdateSchoolProfile() {
  const service = useSchoolProfileService();
  const { tenantKey } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: SchoolProfileUpdate) => service.updateProfile(update),
    onSuccess: () => qc.invalidateQueries({ queryKey: schoolProfileKeys.profile(tenantKey) }),
  });
}

export function useSaveSeal() {
  const service = useSchoolProfileService();
  const { tenantKey } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, filename }: { file: Blob; filename: string }) => service.saveSeal(file, filename),
    onSuccess: () => qc.invalidateQueries({ queryKey: schoolProfileKeys.profile(tenantKey) }),
  });
}

export function useRemoveSeal() {
  const service = useSchoolProfileService();
  const { tenantKey } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => service.removeSeal(),
    onSuccess: () => qc.invalidateQueries({ queryKey: schoolProfileKeys.profile(tenantKey) }),
  });
}
