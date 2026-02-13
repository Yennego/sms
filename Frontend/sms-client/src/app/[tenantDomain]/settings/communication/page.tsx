'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';

type SettingValues = string | number | boolean;

export default function CommunicationSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const initialSettings = {
    enableEmailNotifications: true,
    enableSMSNotifications: false,
    enablePushNotifications: true,
    defaultEmailTemplate: '',
    defaultSMSTemplate: '',
    notificationFrequency: 'immediate',
    allowParentMessaging: true,
    allowStudentMessaging: false,
    moderateMessages: true
  };
  
  const communicationSettingsFields = [
    {
      id: 'enableEmailNotifications',
      label: 'Enable Email Notifications',
      type: 'checkbox' as const
    },
    {
      id: 'enableSMSNotifications',
      label: 'Enable SMS Notifications',
      type: 'checkbox' as const
    },
    {
      id: 'enablePushNotifications',
      label: 'Enable Push Notifications',
      type: 'checkbox' as const
    },
    {
      id: 'defaultEmailTemplate',
      label: 'Default Email Template',
      type: 'text' as const,
      placeholder: 'Enter default email template'
    },
    {
      id: 'defaultSMSTemplate',
      label: 'Default SMS Template',
      type: 'text' as const,
      placeholder: 'Enter default SMS template'
    },
    {
      id: 'notificationFrequency',
      label: 'Notification Frequency',
      type: 'select' as const,
      options: [
        { value: 'immediate', label: 'Immediate' },
        { value: 'hourly', label: 'Hourly' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' }
      ]
    },
    {
      id: 'allowParentMessaging',
      label: 'Allow Parent Messaging',
      type: 'checkbox' as const
    },
    {
      id: 'allowStudentMessaging',
      label: 'Allow Student Messaging',
      type: 'checkbox' as const
    },
    {
      id: 'moderateMessages',
      label: 'Moderate Messages',
      type: 'checkbox' as const
    }
  ];
  
  const handleSubmit = async (values: Record<string, SettingValues>) => {
    setIsLoading(true);
    try {
      console.log('Saving communication settings:', values);
      // TODO: Implement API call
    } catch (error) {
      console.error('Failed to save communication settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Communication Settings</h1>
        
        <SettingsForm
          title="Communication Configuration"
          description="Configure messaging and notification settings"
          fields={communicationSettingsFields}
          initialValues={initialSettings}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </PermissionGuard>
  );
}