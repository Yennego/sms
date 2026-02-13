'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';

type SettingValues = string | number | boolean;

export default function WhatsAppSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const initialSettings = {
    whatsappEnabled: true,
    adminWhatsappNumber: '',
    schoolName: '',
    teacherWelcomeTemplate: '',
    studentWelcomeTemplate: '',
    parentWelcomeTemplate: '',
    notifyAdminOnUserCreation: true,
    notifyParentsOnStudentCreation: true
  };
  
  const whatsappSettingsFields = [
    {
      id: 'whatsappEnabled',
      label: 'Enable WhatsApp Notifications',
      type: 'checkbox' as const
    },
    {
      id: 'adminWhatsappNumber',
      label: 'Admin WhatsApp Number',
      type: 'text' as const,
      placeholder: 'Enter admin WhatsApp number with country code'
    },
    {
      id: 'schoolName',
      label: 'School Name',
      type: 'text' as const,
      placeholder: 'Enter school name for messages'
    },
    {
      id: 'teacherWelcomeTemplate',
      label: 'Teacher Welcome Message Template',
      type: 'text' as const,
      placeholder: 'Enter custom template or leave blank for default'
    },
    {
      id: 'notifyAdminOnUserCreation',
      label: 'Notify Admin on User Creation',
      type: 'checkbox' as const
    }
  ];
  
  const handleSubmit = async (values: Record<string, SettingValues>) => {
    setIsLoading(true);
    try {
      // Call API to save WhatsApp configuration
      console.log('Saving WhatsApp settings:', values);
      // TODO: Implement API call to save tenant notification config
    } catch (error) {
      console.error('Failed to save WhatsApp settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">WhatsApp Settings</h1>
        
        <SettingsForm
          title="WhatsApp Configuration"
          description="Configure WhatsApp notifications for your school"
          fields={whatsappSettingsFields}
          initialValues={initialSettings}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </PermissionGuard>
  );
}