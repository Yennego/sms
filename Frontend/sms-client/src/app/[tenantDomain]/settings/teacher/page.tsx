'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';

type SettingValues = string | number | boolean;

export default function TeacherSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const initialSettings = {
    employeeIdPrefix: 'TCH',
    employeeIdDigits: 6,
    autoGenerateEmail: true,
    emailDomain: 'teachers.school.com',
    defaultWorkingHours: 8,
    maxClassesPerDay: 6,
    allowOvertime: true,
    requireQualificationVerification: true,
    enablePerformanceTracking: true,
    allowSubstituteAssignment: true,
    defaultLeaveAllowance: 30
  };
  
  const teacherSettingsFields = [
    {
      id: 'employeeIdPrefix',
      label: 'Employee ID Prefix',
      type: 'text' as const,
      placeholder: 'Enter prefix for teacher IDs'
    },
    {
      id: 'employeeIdDigits',
      label: 'Employee ID Digits',
      type: 'number' as const,
      placeholder: 'Enter number of digits'
    },
    {
      id: 'autoGenerateEmail',
      label: 'Auto-generate Teacher Email',
      type: 'checkbox' as const
    },
    {
      id: 'emailDomain',
      label: 'Teacher Email Domain',
      type: 'text' as const,
      placeholder: 'Enter email domain'
    },
    {
      id: 'defaultWorkingHours',
      label: 'Default Working Hours per Day',
      type: 'number' as const,
      placeholder: 'Enter hours'
    },
    {
      id: 'maxClassesPerDay',
      label: 'Maximum Classes per Day',
      type: 'number' as const,
      placeholder: 'Enter number'
    },
    {
      id: 'allowOvertime',
      label: 'Allow Overtime',
      type: 'checkbox' as const
    },
    {
      id: 'requireQualificationVerification',
      label: 'Require Qualification Verification',
      type: 'checkbox' as const
    },
    {
      id: 'enablePerformanceTracking',
      label: 'Enable Performance Tracking',
      type: 'checkbox' as const
    },
    {
      id: 'allowSubstituteAssignment',
      label: 'Allow Substitute Teacher Assignment',
      type: 'checkbox' as const
    },
    {
      id: 'defaultLeaveAllowance',
      label: 'Default Annual Leave Allowance (days)',
      type: 'number' as const,
      placeholder: 'Enter days'
    }
  ];
  
  const handleSubmit = async (values: Record<string, SettingValues>) => {
    setIsLoading(true);
    try {
      console.log('Saving teacher settings:', values);
      // TODO: Implement API call
    } catch (error) {
      console.error('Failed to save teacher settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Teacher Settings</h1>
        
        <SettingsForm
          title="Teacher Configuration"
          description="Configure teacher-related settings"
          fields={teacherSettingsFields}
          initialValues={initialSettings}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </PermissionGuard>
  );
}