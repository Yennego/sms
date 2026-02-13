import { useApiClient } from './api-client';
import { useTenant } from '@/hooks/use-tenant';
import { useMemo } from 'react';

// Types for tenant settings
export interface TenantSettings {
  id: string;
  tenant_id: string;
  settings: Record<string, string | number | boolean>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantSettingsCreate {
  tenant_id: string;
  settings: Record<string, string | number | boolean>;
  is_active?: boolean;
}

export interface TenantSettingsUpdate {
  settings?: Record<string, string | number | boolean>;
  is_active?: boolean;
}

// Add WhatsApp notification config types
export interface WhatsAppNotificationConfig {
  id?: string;
  tenant_id?: string;
  whatsapp_enabled: boolean;
  admin_whatsapp_number?: string;
  school_name: string;
  teacher_welcome_template?: string;
  student_welcome_template?: string;
  parent_welcome_template?: string;
  notify_admin_on_user_creation: boolean;
  notify_parents_on_student_creation: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppSettingsInput {
  enabled: boolean;
  admin_number?: string;
  school_name: string;
  templates?: {
    teacher_welcome?: string;
    student_welcome?: string;
    parent_welcome?: string;
  };
  notifications?: {
    admin_on_user_creation: boolean;
    parents_on_student_creation: boolean;
  };
}

export function useSettingsService() {
  const { tenant } = useTenant();
  const apiClient = useApiClient();

  return useMemo(() => ({
    // Get tenant settings
    getTenantSettings: async (): Promise<TenantSettings> => {
      if (!tenant?.id) {
        throw new Error('No tenant ID available');
      }
      return apiClient.get<TenantSettings>(`/tenants/${tenant.id}/settings`);
    },

    // Create tenant settings
    createTenantSettings: async (settings: TenantSettingsCreate): Promise<TenantSettings> => {
      if (!tenant?.id) {
        throw new Error('No tenant ID available');
      }
      return apiClient.post<TenantSettings>(`/tenants/${tenant.id}/settings`, settings);
    },

    // Update tenant settings
    updateTenantSettings: async (settings: TenantSettingsUpdate): Promise<TenantSettings> => {
      if (!tenant?.id) {
        throw new Error('No tenant ID available');
      }
      return apiClient.put<TenantSettings>(`/tenants/${tenant.id}/settings`, settings);
    },

    // Create or update tenant settings (convenience method)
    saveSettings: async (settingsData: Record<string, string | number | boolean>): Promise<TenantSettings> => {
      if (!tenant?.id) {
        throw new Error('No tenant ID available');
      }

      try {
        // Try to fetch first to see if it exists
        await apiClient.get<TenantSettings>(`/tenants/${tenant.id}/settings`);

        // If it exists, update it
        return await apiClient.put<TenantSettings>(`/tenants/${tenant.id}/settings`, {
          settings: settingsData
        });
      } catch (error: any) {
        // If not found or any error fetching, try to create
        console.log('Settings not found or fetch failed, attempting to create...', error);
        return await apiClient.post<TenantSettings>(`/tenants/${tenant.id}/settings`, {
          tenant_id: tenant.id,
          settings: settingsData,
          is_active: true
        });
      }
    },

    // Get WhatsApp notification settings
    getWhatsAppSettings: async (): Promise<WhatsAppNotificationConfig | null> => {
      if (!tenant?.id) {
        throw new Error('No tenant ID available');
      }
      try {
        return await apiClient.get<WhatsAppNotificationConfig>(`/tenants/${tenant.id}/notification-config`);
      } catch (error: unknown) {
        const errObj = (error as { status?: number }) || {};
        if (errObj.status === 404) {
          return null; // No settings found
        }
        throw error;
      }
    },

    // Save WhatsApp notification settings
    saveWhatsAppSettings: async (settings: WhatsAppSettingsInput): Promise<WhatsAppNotificationConfig> => {
      if (!tenant?.id) {
        throw new Error('No tenant ID available');
      }

      const configData = {
        whatsapp_enabled: settings.enabled,
        admin_whatsapp_number: settings.admin_number || null,
        school_name: settings.school_name,
        teacher_welcome_template: settings.templates?.teacher_welcome || null,
        student_welcome_template: settings.templates?.student_welcome || null,
        parent_welcome_template: settings.templates?.parent_welcome || null,
        notify_admin_on_user_creation: settings.notifications?.admin_on_user_creation ?? true,
        notify_parents_on_student_creation: settings.notifications?.parents_on_student_creation ?? true,
      };

      return await apiClient.post<WhatsAppNotificationConfig>(`/tenants/${tenant.id}/notification-config`, configData);
    },
  }), [tenant?.id, apiClient]);
}
