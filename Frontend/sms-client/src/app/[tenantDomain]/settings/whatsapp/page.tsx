'use client';

import { useState, useEffect } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';
import { useSettingsService } from '@/services/api/settings-service';
import { toast } from 'sonner';

// Use the same type as SettingsForm expects
type SettingValues = string | number | boolean;

export default function WhatsAppSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settings, setSettings] = useState<Record<string, SettingValues>>({
    whatsappEnabled: true,
    adminWhatsappNumber: '',
    schoolName: '',
    teacherWelcomeTemplate: '',
    studentWelcomeTemplate: '',
    parentWelcomeTemplate: '',
    notifyAdminOnUserCreation: true,
    notifyParentsOnStudentCreation: true
  });
  const settingsService = useSettingsService();
  
  // Load existing settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoadingSettings(true);
        const data = await settingsService.getWhatsAppSettings();
        if (data) {
          setSettings({
            whatsappEnabled: data.whatsapp_enabled ?? true,
            adminWhatsappNumber: data.admin_whatsapp_number ?? '',
            schoolName: data.school_name ?? '',
            teacherWelcomeTemplate: data.teacher_welcome_template ?? '',
            studentWelcomeTemplate: data.student_welcome_template ?? '',
            parentWelcomeTemplate: data.parent_welcome_template ?? '',
            notifyAdminOnUserCreation: data.notify_admin_on_user_creation ?? true,
            notifyParentsOnStudentCreation: data.notify_parents_on_student_creation ?? true
          });
        }
      } catch (error) {
        console.error('Failed to load WhatsApp settings:', error);
        toast.error('Failed to load WhatsApp settings');
      } finally {
        setIsLoadingSettings(false);
      }
    };

    loadSettings();
  }, [settingsService]);
  
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
      id: 'studentWelcomeTemplate',
      label: 'Student Welcome Message Template',
      type: 'text' as const,
      placeholder: 'Enter custom template or leave blank for default'
    },
    {
      id: 'parentWelcomeTemplate',
      label: 'Parent Welcome Message Template',
      type: 'text' as const,
      placeholder: 'Enter custom template or leave blank for default'
    },
    {
      id: 'notifyAdminOnUserCreation',
      label: 'Notify Admin on User Creation',
      type: 'checkbox' as const
    },
    {
      id: 'notifyParentsOnStudentCreation',
      label: 'Notify Parents on Student Creation',
      type: 'checkbox' as const
    }
  ];
  
  // Make this function synchronous to match SettingsForm expectations
  const handleSubmit = (values: Record<string, SettingValues>) => {
    // Start the async operation but don't await it in the synchronous function
    saveSettings(values);
  };
  
  // Separate async function for the actual saving logic
  const saveSettings = async (values: Record<string, SettingValues>) => {
    try {
      setIsLoading(true);
      const savedSettings = await settingsService.saveWhatsAppSettings({
        enabled: Boolean(values.whatsappEnabled),
        admin_number: String(values.adminWhatsappNumber),
        school_name: String(values.schoolName),
        templates: {
          teacher_welcome: String(values.teacherWelcomeTemplate),
          student_welcome: String(values.studentWelcomeTemplate),
          parent_welcome: String(values.parentWelcomeTemplate),
        },
        notifications: {
          admin_on_user_creation: Boolean(values.notifyAdminOnUserCreation),
          parents_on_student_creation: Boolean(values.notifyParentsOnStudentCreation),
        },
      });
      
      // Update local state with saved values
      setSettings({
        whatsappEnabled: savedSettings.whatsapp_enabled,
        adminWhatsappNumber: savedSettings.admin_whatsapp_number ?? '',
        schoolName: savedSettings.school_name,
        teacherWelcomeTemplate: savedSettings.teacher_welcome_template ?? '',
        studentWelcomeTemplate: savedSettings.student_welcome_template ?? '',
        parentWelcomeTemplate: savedSettings.parent_welcome_template ?? '',
        notifyAdminOnUserCreation: savedSettings.notify_admin_on_user_creation,
        notifyParentsOnStudentCreation: savedSettings.notify_parents_on_student_creation,
      });
      
      // Beautiful toast notification! 🎉
      toast.success('WhatsApp settings saved successfully!');
      toast.error('Failed to save WhatsApp settings');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">WhatsApp Settings</h1>
        
        {isLoadingSettings ? (
          <div>Loading settings...</div>
        ) : (
          <SettingsForm
            title="WhatsApp Configuration"
            description="Configure WhatsApp notifications for your school"
            fields={whatsappSettingsFields}
            initialValues={settings}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}
      </div>
    </PermissionGuard>
  );
}