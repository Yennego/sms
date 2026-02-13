import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { useMemo, useCallback } from 'react';
import type { AcademicYear, AcademicYearCreate, AcademicYearUpdate } from '@/types/enrollment';

export function useAcademicYearService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = createWaitForApiClientReady(apiClient);

  const getAcademicYears = useCallback(async (includeArchived?: boolean): Promise<AcademicYear[]> => {
    const client = await waitForApiClientReady();
    const url = includeArchived ? '/academics/academic-years?include_archived=true' : '/academics/academic-years';
    return client.get<AcademicYear[]>(url);
  }, [waitForApiClientReady]);

  const getCurrentAcademicYear = useCallback(async (): Promise<AcademicYear | null> => {
    const client = await waitForApiClientReady();
    return client.get<AcademicYear | null>('/academics/academic-years/current');
  }, [waitForApiClientReady]);

  const createAcademicYear = useCallback(async (payload: AcademicYearCreate): Promise<AcademicYear> => {
    const client = await waitForApiClientReady();
    return client.post<AcademicYear>('/academics/academic-years', payload);
  }, [waitForApiClientReady]);

  const updateAcademicYear = useCallback(async (id: string, payload: AcademicYearUpdate): Promise<AcademicYear> => {
    const client = await waitForApiClientReady();
    return client.put<AcademicYear>(`/academics/academic-years/${id}`, payload);
  }, [waitForApiClientReady]);

  const deleteAcademicYear = useCallback(async (id: string): Promise<void> => {
    const client = await waitForApiClientReady();
    await client.delete<void>(`/academics/academic-years/${id}`);
  }, [waitForApiClientReady]);

  const setCurrentAcademicYear = useCallback(async (id: string): Promise<AcademicYear> => {
    return updateAcademicYear(id, { is_current: true });
  }, [updateAcademicYear]);

  const service = useMemo(() => ({
    getAcademicYears,
    getCurrentAcademicYear,
    createAcademicYear,
    updateAcademicYear,
    deleteAcademicYear,
    setCurrentAcademicYear,
    archiveAcademicYear: async (id: string): Promise<{ success: boolean }> => {
      const client = await waitForApiClientReady();
      return client.post<{ success: boolean }>(`/academics/academic-years/${id}/archive`, {});
    }
  }), [getAcademicYears, getCurrentAcademicYear, createAcademicYear, updateAcademicYear, deleteAcademicYear, setCurrentAcademicYear, waitForApiClientReady]);
  return service;
}
