import { useApiClient } from '@/services/api/api-client';
import { createSectionService } from '@/services/api/section-service';
import { useMemo } from 'react';

export const useSectionService = () => {
  const apiClient = useApiClient();
  
  const sectionService = useMemo(() => {
    return createSectionService(apiClient);
  }, [apiClient]);
  
  return sectionService;
};