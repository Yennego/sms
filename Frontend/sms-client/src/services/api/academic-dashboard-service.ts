import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { useMemo, useCallback } from 'react';

export interface AcademicDashboardStats {
    total_students: number;
    total_teachers: number;
    total_classes: number;
    total_subjects: number;
    total_grades: number;
    total_sections: number;
    active_academic_year: string;
    assignment_completion: number;
    enrollment_completion: number;
    configuration_score: number;
}

export function useAcademicDashboardService() {
    const { apiClient } = useApiClientWithLoading();
    const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

    const getStats = useCallback(async (): Promise<AcademicDashboardStats> => {
        const client = await waitForApiClientReady();
        return client.get<AcademicDashboardStats>('/academics/dashboard/stats');
    }, [waitForApiClientReady]);

    return useMemo(() => ({
        getStats
    }), [getStats]);
}
