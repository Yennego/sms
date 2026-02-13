'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';

export default function CommunicationSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const initialSettings = {
    enableEmailNotifications: true,
    enableSMSNotifications: false,
    enablePushNotifications: true,
    defaultSenderName: 'School Admin',
    defaultSenderEmail: 'admin@school.com',
    emailFooterText: 'This is an automated message from the School Management System.',
    announcementApprovalRequired: true,
    allowParentMessaging: true,
    allowStudentMessaging: false,
    messageRetentionDays: 90
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
      id: 'defaultSenderName',
      label: 'Default Sender Name',
      type: 'text' as const,
      placeholder: 'Enter sender name'
    },
    {
      id: 'defaultSenderEmail',
      label: 'Default Sender Email',
      type: 'text' as const,
      placeholder: 'Enter sender email'
    },
    {
      id: 'emailFooterText',
      label: 'Email Footer Text',
      type: 'text' as const,
      placeholder: 'Enter footer text'
    },
    {
      id: 'announcementApprovalRequired',
      label: 'Require Approval for Announcements',
      type: 'checkbox' as const
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
      id: 'messageRetentionDays',
      label: 'Message Retention Period (days)',
      type: 'number' as const,
      placeholder: 'Enter days'
    }
  ];
  
  const handleSubmit = (values: Record<string, string | boolean | number>) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log('Communication settings saved:', values);
      setIsLoading(false);
    }, 1000);
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Communication Settings</h1>
        
        <div className="space-y-8">
          <SettingsForm
            title="Communication Configuration"
            description="Configure messaging and notification settings"
            fields={communicationSettingsFields}
            initialValues={initialSettings}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </PermissionGuard>
  );
}