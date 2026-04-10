import { useQuery } from '@tanstack/react-query';
import { useSuperAdminApiClient } from '@/services/api/super-admin-api-client';
import { useTenant } from '@/hooks/use-tenant';

export interface ApiMetadata {
  path: string;
  methods: string[];
  summary: string;
  description: string;
  tags: string[];
  status: 'active' | 'inactive' | 'error';
}

export interface ApiMetadataResponse {
  items: ApiMetadata[];
  total: number;
  skip: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}

export function useApiMetadata(params: {
  skip?: number;
  limit?: number;
  search?: string;
}) {
  const apiClient = useSuperAdminApiClient();
  const { tenantKey } = useTenant();

  return useQuery({
    queryKey: ['api-metadata', tenantKey, params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
      if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
      if (params.search) queryParams.append('search', params.search);

      const url = `/super-admin/dashboard/api-metadata?${queryParams.toString()}`;
      return apiClient.get<ApiMetadataResponse>(url);
    },
  });
}
