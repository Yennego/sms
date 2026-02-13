import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import { useMemo } from 'react';

export interface Submission {
    id: string;
    assignment_id: string;
    student_id: string;
    content?: string;
    attachment_url?: string;
    status: string;
    grade_id?: string;
    submitted_at: string;
    score?: number;
    feedback?: string;
}

export interface SubmissionCreate {
    assignment_id: string;
    content?: string;
    attachment_url?: string;
}

export function useSubmissionService() {
    const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
    const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

    return useMemo(() => ({
        submitAssignment: async (payload: SubmissionCreate): Promise<Submission> => {
            const client = await waitForApiClientReady();
            return client.post<Submission>('/academics/submissions', payload);
        },

        getAssignmentSubmissions: async (assignmentId: string): Promise<Submission[]> => {
            const client = await waitForApiClientReady();
            return client.get<Submission[]>(`/academics/submissions/assignment/${assignmentId}`);
        },

        getStudentSubmissions: async (studentId: string): Promise<Submission[]> => {
            const client = await waitForApiClientReady();
            return client.get<Submission[]>(`/academics/submissions/student/${studentId}`);
        },

        getMySubmissions: async (): Promise<Submission[]> => {
            const client = await waitForApiClientReady();
            return client.get<Submission[]>('/academics/submissions/my-submissions');
        },

        getSubmissionById: async (id: string): Promise<Submission> => {
            const client = await waitForApiClientReady();
            return client.get<Submission>(`/academics/submissions/${id}`);
        },

        gradeSubmission: async (id: string, payload: { score: number; feedback?: string }): Promise<Submission> => {
            const client = await waitForApiClientReady();
            return client.put<Submission>(`/academics/submissions/${id}/grade`, payload);
        }
    }), [waitForApiClientReady]);
}
