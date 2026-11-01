// Communication (phase6-design.md section 8, "As built"): /api/v1/communication.
//
//   GET  /communication/inbox?unread_only&page&page_size  -> the caller's alerts and announcements
//   GET  /communication/inbox/unread-count                -> {unread} (the bell)
//   POST /communication/inbox/{id}/read, /inbox/read-all   -> {unread}
//   GET  /communication/preferences, PUT [{event, email}]   -> one email switch per event
//   GET  /communication/announcements, /announcements/audiences, POST /announcements,
//   POST /communication/announcements/{id}/withdraw
//   GET  /communication/deliveries, POST /deliveries/{id}/retry (manage_tenant_settings)
//
// Times are ISO 8601 with an offset; ids are UUID strings. Lists are paged from 1.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

const BASE = '/communication';

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ---- Inbox ---------------------------------------------------------------------------------------

export const NOTIFICATION_EVENTS = [
  'attendance_absent',
  'attendance_late',
  'results_published',
  'payment_received',
  'announcement',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export interface InboxItem {
  id: string;
  event: NotificationEvent | string;
  title: string;
  body: string;
  /** An app path including the school (`/{school}/...`), or null (announcements: show the body). */
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface InboxPage extends Paged<InboxItem> {
  unread: number;
}

export interface InboxParams {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

// ---- Email switches ------------------------------------------------------------------------------

export interface PreferenceItem {
  event: NotificationEvent;
  /** "Absence alerts", "Late arrival alerts", ... (from the server) */
  label: string;
  email: boolean;
}

export interface Preferences {
  /** The user's email address; null when they have none (no email is sent to them). */
  email: string | null;
  /** False while the server has no email settings: nothing is emailed to anyone. */
  email_configured: boolean;
  items: PreferenceItem[];
}

export interface PreferenceInput {
  event: NotificationEvent;
  email: boolean;
}

// ---- Announcements -------------------------------------------------------------------------------

export type AnnouncementAudience = 'all' | 'role' | 'class' | 'family';
export const AUDIENCE_ROLES = ['parents', 'students', 'teachers', 'staff'] as const;
export type AudienceRole = (typeof AUDIENCE_ROLES)[number];

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  audience_role: AudienceRole | null;
  class_id: string | null;
  student_id: string | null;
  /** "Everyone", "Parents", "Class Grade 5 - A", "Family of Ama Kollie", ... */
  audience_label: string;
  author_id: string | null;
  author_name: string | null;
  sent_at: string;
  withdrawn_at: string | null;
  /** Inbox notifications written when it was sent (the author is never one). */
  recipient_count: number;
  can_withdraw: boolean;
}

/** What the caller may target. Empty roles and classes and no family: they can't send. */
export interface Audiences {
  roles: AudienceRole[];
  classes: { id: string; name: string }[];
  family: boolean;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  audience_role?: AudienceRole;
  class_id?: string;
  student_id?: string;
}

export const TITLE_MAX = 200;
export const BODY_MAX = 5000;

// ---- Delivery log --------------------------------------------------------------------------------

export const DELIVERY_STATUSES = ['queued', 'sent', 'failed', 'skipped'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export const DELIVERY_CHANNELS = ['email', 'sms'] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export interface Delivery {
  id: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  event: NotificationEvent | string;
  title: string;
}

export interface DeliveryPage extends Paged<Delivery> {
  /** Follow the channel and date filters, not the status filter. */
  counts: Record<DeliveryStatus, number>;
}

export interface DeliveryParams {
  status?: DeliveryStatus | '';
  channel?: DeliveryChannel | '';
  /** yyyy-mm-dd, school time, on created_at */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// ---- Helpers -------------------------------------------------------------------------------------

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    out.set(key, String(value));
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

const id = encodeURIComponent;

// ---- Service -------------------------------------------------------------------------------------

export function useCommunicationService() {
  const { apiClient } = useApiClientWithLoading();
  const ready = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      // Inbox
      getInbox: async (p: InboxParams) =>
        (await ready()).get<InboxPage>(
          `${BASE}/inbox${qs({ unread_only: p.unreadOnly, page: p.page ?? 1, page_size: p.pageSize ?? 20 })}`
        ),
      getUnreadCount: async () => (await ready()).get<{ unread: number }>(`${BASE}/inbox/unread-count`),
      markRead: async (notificationId: string) =>
        (await ready()).post<{ unread: number }>(`${BASE}/inbox/${id(notificationId)}/read`),
      markAllRead: async () => (await ready()).post<{ unread: number }>(`${BASE}/inbox/read-all`),

      // Email switches
      getPreferences: async () => (await ready()).get<Preferences>(`${BASE}/preferences`),
      updatePreferences: async (items: PreferenceInput[]) =>
        (await ready()).put<Preferences>(`${BASE}/preferences`, items),

      // Announcements
      listAnnouncements: async (page = 1, pageSize = 20) =>
        (await ready()).get<Paged<Announcement>>(`${BASE}/announcements${qs({ page, page_size: pageSize })}`),
      getAudiences: async () => (await ready()).get<Audiences>(`${BASE}/announcements/audiences`),
      sendAnnouncement: async (a: AnnouncementInput) => (await ready()).post<Announcement>(`${BASE}/announcements`, a),
      withdrawAnnouncement: async (announcementId: string) =>
        (await ready()).post<Announcement>(`${BASE}/announcements/${id(announcementId)}/withdraw`),

      // Delivery log
      listDeliveries: async (p: DeliveryParams) =>
        (await ready()).get<DeliveryPage>(
          `${BASE}/deliveries${qs({
            status: p.status,
            channel: p.channel,
            from: p.from,
            to: p.to,
            page: p.page ?? 1,
            page_size: p.pageSize ?? 25,
          })}`
        ),
      retryDelivery: async (deliveryId: string) =>
        (await ready()).post<Delivery>(`${BASE}/deliveries/${id(deliveryId)}/retry`),
    }),
    [ready]
  );
}
