import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
// import { DashboardStats } from './types';

export interface DashboardStats {
  students: {
    total: number;
    active: number;
    inactive: number;
    new_this_month: number;
    growth_rate: number;
  };
  teachers: {
    total: number;
    active: number;
    inactive: number;
    new_this_month: number;
  };
  classes: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    active: number;
    recent_logins: number;
  };
  recent_activities: unknown[];
  pending_tasks: {
    pending_teacher_approvals: number;
    pending_student_registrations: number;
    upcoming_events: number;
  };
}

export function useAdminDashboardService() {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
  const waitForApiClientReady = createWaitForApiClientReady(apiClient);

  const getDashboardStats = async (): Promise<DashboardStats> => {
    let attempt = 0;
    const maxAttempts = 2;
    while (attempt < maxAttempts) {
      try {
        const client = await waitForApiClientReady();
        return await client.get<DashboardStats>('/tenants/dashboard/stats');
      } catch (err) {
        attempt++;
        console.warn(`[DashboardService] Attempt ${attempt} failed:`, err);
        if (attempt === maxAttempts) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Max retry attempts reached');
  };

  return {
    getDashboardStats,
  };
}
