import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { useMemo, useCallback } from 'react';

export interface AcademicSetupStatus {
    academic_years: number;
    grades: number;
    sections: number;
    subjects: number;
    classes: number;
    teachers: number;
    students: number;
    teacher_assignments: number;
    student_enrollments: number;
    semesters: number;
    current_academic_year_id?: string;
    current_academic_year_name?: string;
}

export function useAcademicSetupService() {
    const { apiClient } = useApiClientWithLoading();
    const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

    const getSetupStatus = useCallback(async (): Promise<AcademicSetupStatus> => {
        const client = await waitForApiClientReady();
        return client.get<AcademicSetupStatus>('/academics/setup/status');
    }, [waitForApiClientReady]);

    return useMemo(() => ({
        getSetupStatus
    }), [getSetupStatus]);
}
