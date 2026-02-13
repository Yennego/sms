import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { useMemo } from 'react';
import {
  AcademicGrade,
  AcademicGradeCreate,
  AcademicGradeUpdate
} from '@/types/academic-grade';

export function useAcademicGradeService() {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
  // Memoize the waiter function to ensure stability
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  const service = useMemo(() => ({
    getActiveGrades: async (): Promise<AcademicGrade[]> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = '/academics/academic-grades?is_active=true';
        return await client.get<AcademicGrade[]>(endpoint);
      } catch (error) {
        console.error('Error fetching academic grades:', error);
        throw error;
      }
    },

    getAllGrades: async (): Promise<AcademicGrade[]> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = '/academics/academic-grades';
        return await client.get<AcademicGrade[]>(endpoint);
      } catch (error) {
        console.error('Error fetching all academic grades:', error);
        throw error;
      }
    },

    // New: Backward-compatible alias to match existing page usage
    getGrades: async (): Promise<AcademicGrade[]> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = '/academics/academic-grades';
        return await client.get<AcademicGrade[]>(endpoint);
      } catch (error) {
        console.error('Error fetching grades:', error);
        throw error;
      }
    },

    getGradeById: async (id: string): Promise<AcademicGrade> => {
      const client = await waitForApiClientReady();
      try {
        const endpoint = `/academics/academic-grades/${id}`;
        return await client.get<AcademicGrade>(endpoint);
      } catch (error) {
        console.error('Error fetching grade by id:', error);
        throw error;
      }
    },

    // New: CRUD for grade configuration
    createGrade: async (payload: AcademicGradeCreate): Promise<AcademicGrade> => {
      const client = await waitForApiClientReady();
      return client.post<AcademicGrade>('/academics/academic-grades', payload);
    },

    updateGrade: async (id: string, payload: AcademicGradeUpdate): Promise<AcademicGrade> => {
      const client = await waitForApiClientReady();
      return client.put<AcademicGrade>(`/academics/academic-grades/${id}`, payload);
    },

    deleteGrade: async (id: string): Promise<void> => {
      const client = await waitForApiClientReady();
      return client.delete<void>(`/academics/academic-grades/${id}`);
    }
  }), [waitForApiClientReady]);

  return service;
}
