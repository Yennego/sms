import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import type { Subject, SubjectCreate, SubjectUpdate } from '@/types/subject';
import { useMemo } from 'react';

export const useSubjectService = () => {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(() => ({
    getActiveSubjects: async (): Promise<Subject[]> => {
      const client = await waitForApiClientReady();
      try {
        const response = await client.get<Subject[]>('/academics/subjects?is_active=true');
        return response || [];
      } catch (error) {
        console.error('Error fetching active subjects:', error);
        throw error;
      }
    },

    getAllSubjects: async (): Promise<Subject[]> => {
      const client = await waitForApiClientReady();
      try {
        const response = await client.get<Subject[]>('/academics/subjects');
        return response || [];
      } catch (error) {
        console.error('Error fetching all subjects:', error);
        throw error;
      }
    },

    getSubjectById: async (id: string): Promise<Subject> => {
      const client = await waitForApiClientReady();
      try {
        const response = await client.get<Subject>(`/academics/subjects/${id}`);
        return response;
      } catch (error) {
        console.error('Error fetching subject by ID:', error);
        throw error;
      }
    },

    getSubjectByCode: async (code: string): Promise<Subject> => {
      const client = await waitForApiClientReady();
      try {
        const response = await client.get<Subject>(`/academics/subjects/code/${code}`);
        return response;
      } catch (error) {
        console.error('Error fetching subject by code:', error);
        throw error;
      }
    },

    createSubject: async (payload: SubjectCreate): Promise<Subject> => {
      const client = await waitForApiClientReady();
      try {
        return await client.post<Subject>('/academics/subjects', payload);
      } catch (error) {
        console.error('Error creating subject:', error);
        throw error;
      }
    },

    updateSubject: async (id: string, payload: SubjectUpdate): Promise<Subject> => {
      const client = await waitForApiClientReady();
      try {
        return await client.put<Subject>(`/academics/subjects/${id}`, payload);
      } catch (error) {
        console.error('Error updating subject:', error);
        throw error;
      }
    },

    deleteSubject: async (id: string): Promise<void> => {
      const client = await waitForApiClientReady();
      try {
        await client.delete<void>(`/academics/subjects/${id}`);
      } catch (error) {
        console.error('Error deleting subject:', error);
        throw error;
      }
    },
  }), [waitForApiClientReady]);
};