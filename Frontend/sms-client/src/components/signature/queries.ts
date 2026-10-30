// TanStack Query hooks for "My signature". Keys start with the school (and the signed-in person),
// so switching schools or accounts never shows someone else's signature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useSignatureService } from '@/services/api/signature-service';

export const signatureKeys = {
  mine: (school: string | null, userId: string | null) => ['my-signature', school, userId] as const,
};

function useMineKey() {
  const { tenantKey } = useTenant();
  const { user } = useAuth();
  return { school: tenantKey, key: signatureKeys.mine(tenantKey, user?.id ?? null) };
}

export function useMySignature() {
  const service = useSignatureService();
  const { school, key } = useMineKey();
  return useQuery({
    queryKey: key,
    queryFn: () => service.getMine(),
    enabled: Boolean(school),
    retry: (count, error) => {
      const status = (error as { statusCode?: number } | null)?.statusCode;
      return status !== 403 && status !== 404 && count < 2;
    },
  });
}

export function useSaveMySignature() {
  const service = useSignatureService();
  const { key } = useMineKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, filename }: { file: Blob; filename: string }) => service.saveMine(file, filename),
    onSuccess: (saved) => {
      if (saved.image) qc.setQueryData(key, saved);
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useRemoveMySignature() {
  const service = useSignatureService();
  const { key } = useMineKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => service.removeMine(),
    onSuccess: () => {
      qc.setQueryData(key, { has_signature: false, image: null, updated_at: null });
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
