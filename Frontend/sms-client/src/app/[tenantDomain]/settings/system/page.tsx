'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';

type SettingValues = string | number | boolean;

export default function SystemSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const initialSettings = {
    siteName: 'School Management System',
    defaultLanguage: 'en',
    sessionTimeout: 30,
    maintenanceMode: false,
    allowRegistration: true,
    emailNotifications: true,
    dataRetentionDays: 90
  };
  
  const systemSettingsFields = [
    {
      id: 'siteName',
      label: 'Site Name',
      type: 'text' as const,
      placeholder: 'Enter site name'
    },
    {
      id: 'defaultLanguage',
      label: 'Default Language',
      type: 'select' as const,
      options: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' }
      ]
    },
    {
      id: 'sessionTimeout',
      label: 'Session Timeout (minutes)',
      type: 'number' as const,
      placeholder: 'Enter timeout in minutes'
    },
    {
      id: 'dataRetentionDays',
      label: 'Data Retention Period (days)',
      type: 'number' as const,
      placeholder: 'Enter days'
    },
    {
      id: 'maintenanceMode',
      label: 'Maintenance Mode',
      type: 'checkbox' as const
    },
    {
      id: 'allowRegistration',
      label: 'Allow User Registration',
      type: 'checkbox' as const
    },
    {
      id: 'emailNotifications',
      label: 'Enable Email Notifications',
      type: 'checkbox' as const
    }
  ];
  
  const handleSubmit = async (values: Record<string, SettingValues>) => {
    setIsLoading(true);
    try {
      console.log('Saving system settings:', values);
      // TODO: Implement API call
    } catch (error) {
      console.error('Failed to save system settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">System Settings</h1>
        
        <SettingsForm
          title="System Configuration"
          description="Configure global system settings and defaults"
          fields={systemSettingsFields}
          initialValues={initialSettings}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </PermissionGuard>
  );
}