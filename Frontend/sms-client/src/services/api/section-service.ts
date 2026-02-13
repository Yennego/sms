import type { 
  Section, 
  SectionCreate, 
  SectionUpdate, 
  SectionResponse,
  SectionWithDetails 
} from '@/types/section';
import type { ApiClient } from './api-client';
import { useApiClientWithLoading } from './api-client';
import { useMemo } from 'react';

export type SectionService = {
  getSections(params?: { page?: number; size?: number; grade_id?: string }): Promise<SectionResponse>;
  getSectionsByGrade(gradeId: string): Promise<Section[]>;
  getSectionById(id: string): Promise<SectionWithDetails>;
  createSection(data: SectionCreate): Promise<Section>;
  updateSection(id: string, data: SectionUpdate): Promise<Section>;
  deleteSection(id: string): Promise<void>;
};

export const createSectionService = (apiClient: ApiClient): SectionService => ({
  // Get all sections
  getSections: async (params?: {
    page?: number;
    size?: number;
    grade_id?: string;
  }): Promise<SectionResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.size) searchParams.append('size', params.size.toString());
    if (params?.grade_id) searchParams.append('grade_id', params.grade_id);
    
    const list = await apiClient.get<Section[]>(`/academics/sections?${searchParams}`);
    return {
      sections: Array.isArray(list) ? list : [],
      total: Array.isArray(list) ? list.length : 0,
      page: 1,
      size: Array.isArray(list) ? list.length : 0,
      pages: 1
    };
  },

  // Get sections by grade
  getSectionsByGrade: async (gradeId: string): Promise<Section[]> => {
    const response = await apiClient.get<Section[]>(`/academics/sections?grade_id=${gradeId}&is_active=true`);
    if (Array.isArray(response)) return response;
    return [];
  },

  getSectionById: async (id: string): Promise<SectionWithDetails> => {
    const response = await apiClient.get<SectionWithDetails>(`/academics/sections/${id}`);
    return response;
  },

  createSection: async (data: SectionCreate): Promise<Section> => {
    const response = await apiClient.post<Section>('/academics/sections', data);
    return response;
  },

  updateSection: async (id: string, data: SectionUpdate): Promise<Section> => {
    const response = await apiClient.put<Section>(`/academics/sections/${id}`, data);
    return response;
  },

  deleteSection: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/academics/sections/${id}`);
  }
});

// Hook version for use in React components
export const useSectionService = (): SectionService => {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();

  const service = useMemo<SectionService>(() => {
    if (!apiClient || apiLoading) {
      // Return stubs while loading to keep identity stable
      return {
        getSections: async () => ({
          sections: [],
          total: 0,
          pages: 0,
          page: 1,
          size: 0
        }),
        getSectionsByGrade: async (_gradeId: string) => {
          void _gradeId;
          return [];
        },
        getSectionById: async (_id: string) => {
          void _id;
          throw new Error('API client not ready');
        },
        createSection: async (_data: SectionCreate) => {
          void _data;
          throw new Error('API client not ready');
        },
        updateSection: async (_id: string, _data: SectionUpdate) => {
          void _id;
          void _data;
          throw new Error('API client not ready');
        },
        deleteSection: async (_id: string) => {
          void _id;
          throw new Error('API client not ready');
        },
      };
    }
    return createSectionService(apiClient);
  }, [apiClient, apiLoading]);

  return service;
}