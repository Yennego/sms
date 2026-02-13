import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { useMemo } from 'react';

export interface StudentStats {
    gpa: number;
    active_courses: number;
    pending_tasks: number;
    attendance_percentage: number;
}

export interface TeacherStats {
    assigned_classes: number;
    total_students: number;
    pending_grades: number;
    active_assignments: number;
}

export interface DashboardStats {
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
    student_stats?: StudentStats;
    teacher_stats?: TeacherStats;
}

export function useDashboardService() {
    const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
    const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

    return useMemo(() => ({
        getStats: async (): Promise<DashboardStats> => {
            const client = await waitForApiClientReady();
            return client.get<DashboardStats>('/academics/dashboard/stats');
        }
    }), [waitForApiClientReady]);
}
