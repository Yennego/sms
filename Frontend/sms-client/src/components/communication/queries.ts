// TanStack Query hooks for the inbox, announcements, email switches and the delivery log. Every key
// starts with ['communication', school], so a shared phone signed into another school never shows
// the wrong inbox, and one invalidation refreshes the bell and the lists together.
import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTenant } from '@/hooks/use-tenant';
import { useClassPlacementService } from '@/services/api/class-placement-service';
import {
  useCommunicationService,
  type AnnouncementInput,
  type DeliveryParams,
  type InboxParams,
  type PreferenceInput,
} from '@/services/api/communication-service';

export const communicationKeys = {
  all: (school: string | null) => ['communication', school] as const,
  unread: (school: string | null) => [...communicationKeys.all(school), 'unread'] as const,
  inbox: (school: string | null, params?: InboxParams) =>
    params
      ? ([...communicationKeys.all(school), 'inbox', params] as const)
      : ([...communicationKeys.all(school), 'inbox'] as const),
  preferences: (school: string | null) => [...communicationKeys.all(school), 'preferences'] as const,
  announcements: (school: string | null, page?: number) =>
    page
      ? ([...communicationKeys.all(school), 'announcements', page] as const)
      : ([...communicationKeys.all(school), 'announcements'] as const),
  audiences: (school: string | null) => [...communicationKeys.all(school), 'audiences'] as const,
  students: (school: string | null, q: string) => [...communicationKeys.all(school), 'students', q] as const,
  deliveries: (school: string | null, params?: DeliveryParams) =>
    params
      ? ([...communicationKeys.all(school), 'deliveries', params] as const)
      : ([...communicationKeys.all(school), 'deliveries'] as const),
};

/** The bell polls this often (phase6-design.md section 5). */
export const UNREAD_POLL_MS = 60 * 1000;

/** Don't retry answers that won't change (no permission, not found, invalid). */
function noRetryOnClientError(count: number, error: unknown) {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return !(status && status >= 400 && status < 500) && count < 2;
}

function useSchool() {
  return useTenant().tenantKey;
}

// ---- Inbox ---------------------------------------------------------------------------------------

/**
 * The bell's unread count. Polls every 60 s while the tab is visible: TanStack Query pauses the
 * interval while the document is hidden and fetches again when the tab comes back.
 */
export function useUnreadCount() {
  const service = useCommunicationService();
  const school = useSchool();
  return useQuery({
    queryKey: communicationKeys.unread(school),
    queryFn: () => service.getUnreadCount(),
    enabled: Boolean(school),
    refetchInterval: UNREAD_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    retry: noRetryOnClientError,
  });
}

export function useInbox(params: InboxParams) {
  const service = useCommunicationService();
  const school = useSchool();
  return useQuery({
    queryKey: communicationKeys.inbox(school, params),
    queryFn: () => service.getInbox(params),
    enabled: Boolean(school),
    placeholderData: keepPreviousData,
    retry: noRetryOnClientError,
  });
}

/** After a read: put the new count on the bell and refresh the inbox lists. */
function useAfterRead() {
  const qc = useQueryClient();
  const school = useSchool();
  return React.useCallback(
    (data: { unread: number }) => {
      qc.setQueryData(communicationKeys.unread(school), { unread: data.unread });
      return qc.invalidateQueries({ queryKey: communicationKeys.inbox(school) });
    },
    [qc, school]
  );
}

export function useMarkRead() {
  const service = useCommunicationService();
  const afterRead = useAfterRead();
  return useMutation({
    mutationFn: (notificationId: string) => service.markRead(notificationId),
    onSuccess: afterRead,
  });
}

export function useMarkAllRead() {
  const service = useCommunicationService();
  const afterRead = useAfterRead();
  return useMutation({
    mutationFn: () => service.markAllRead(),
    onSuccess: afterRead,
  });
}

// ---- Email switches ------------------------------------------------------------------------------

export function usePreferences() {
  const service = useCommunicationService();
  const school = useSchool();
  return useQuery({
    queryKey: communicationKeys.preferences(school),
    queryFn: () => service.getPreferences(),
    enabled: Boolean(school),
    retry: noRetryOnClientError,
  });
}

export function useUpdatePreferences() {
  const service = useCommunicationService();
  const school = useSchool();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: PreferenceInput[]) => service.updatePreferences(items),
    onSuccess: (data) => qc.setQueryData(communicationKeys.preferences(school), data),
  });
}

// ---- Announcements -------------------------------------------------------------------------------

export function useAnnouncements(page: number) {
  const service = useCommunicationService();
  const school = useSchool();
  return useQuery({
    queryKey: communicationKeys.announcements(school, page),
    queryFn: () => service.listAnnouncements(page),
    enabled: Boolean(school),
    placeholderData: keepPreviousData,
    retry: noRetryOnClientError,
  });
}

export function useAudiences() {
  const service = useCommunicationService();
  const school = useSchool();
  return useQuery({
    queryKey: communicationKeys.audiences(school),
    queryFn: () => service.getAudiences(),
    enabled: Boolean(school),
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnClientError,
  });
}

/**
 * Students matching a name or admission number, for a family announcement (the class placement
 * roster: needs view_students, which everyone with send_announcements has). Two letters at least.
 */
export function useStudentSearch(q: string) {
  const service = useClassPlacementService();
  const school = useSchool();
  const term = q.trim();
  return useQuery({
    queryKey: communicationKeys.students(school, term),
    queryFn: () => service.getRoster({ q: term, sort: 'name', page: 1, pageSize: 8 }),
    enabled: Boolean(school) && term.length >= 2,
    staleTime: 30 * 1000,
    retry: noRetryOnClientError,
  });
}

function useInvalidateAnnouncements() {
  const qc = useQueryClient();
  const school = useSchool();
  return React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: communicationKeys.announcements(school) });
    // Withdrawing removes it from inboxes too (the author's own, for an admin who received it)
    void qc.invalidateQueries({ queryKey: communicationKeys.inbox(school) });
    void qc.invalidateQueries({ queryKey: communicationKeys.unread(school) });
  }, [qc, school]);
}

export function useSendAnnouncement() {
  const service = useCommunicationService();
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (a: AnnouncementInput) => service.sendAnnouncement(a),
    onSuccess: invalidate,
  });
}

export function useWithdrawAnnouncement() {
  const service = useCommunicationService();
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (announcementId: string) => service.withdrawAnnouncement(announcementId),
    onSuccess: invalidate,
  });
}

// ---- Delivery log --------------------------------------------------------------------------------

export function useDeliveries(params: DeliveryParams) {
  const service = useCommunicationService();
  const school = useSchool();
  return useQuery({
    queryKey: communicationKeys.deliveries(school, params),
    queryFn: () => service.listDeliveries(params),
    enabled: Boolean(school),
    placeholderData: keepPreviousData,
    retry: noRetryOnClientError,
  });
}

export function useRetryDelivery() {
  const service = useCommunicationService();
  const school = useSchool();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => service.retryDelivery(deliveryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: communicationKeys.deliveries(school) }),
  });
}
