// TanStack Query hooks for the school's admin pages. Keys start with the school, so switching
// schools never shows another school's records.
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useSchoolKey } from '@/components/students/queries';
import { useActivityLogService } from '@/services/api/activity-log-service';

export const adminKeys = {
  all: (school: string | null) => ['admin-area', school] as const,
  auditLog: (school: string | null, params: AuditLogParams) => [...adminKeys.all(school), 'audit-log', params] as const,
};

export interface AuditLogParams {
  action: string;
  entityType: string;
  page: number;
  pageSize: number;
}

/** One page of the school's audit log (GET /logging/audit-logs), newest first. */
export function useAuditLog(params: AuditLogParams) {
  const school = useSchoolKey();
  const service = useActivityLogService();
  return useQuery({
    queryKey: adminKeys.auditLog(school, params),
    queryFn: () =>
      service.getActivityLogs({
        skip: (params.page - 1) * params.pageSize,
        limit: params.pageSize,
        action: params.action || undefined,
        entity_type: params.entityType || undefined,
      }),
    placeholderData: keepPreviousData,
  });
}
