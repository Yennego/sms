'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';

export default function TeacherSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const initialSettings = {
    employeeIdPrefix: 'TCH',
    employeeIdDigits: 4,
    autoGenerateEmail: true,
    emailDomain: 'teachers.school.com',
    maxWeeklyHours: 30,
    maxDailyPeriods: 6,
    requireQualificationVerification: true,
    enablePerformanceTracking: true,
    allowSubstituteAssignment: true,
    defaultLeaveAllowance: 20
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
      id: 'maxWeeklyHours',
      label: 'Maximum Weekly Teaching Hours',
      type: 'number' as const,
      placeholder: 'Enter hours'
    },
    {
      id: 'maxDailyPeriods',
      label: 'Maximum Daily Teaching Periods',
      type: 'number' as const,
      placeholder: 'Enter number of periods'
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
  
  const handleSubmit = (values: Record<string, string | boolean | number>) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log('Teacher settings saved:', values);
      setIsLoading(false);
    }, 1000);
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Teacher Settings</h1>
        
        <div className="space-y-8">
          <SettingsForm
            title="Teacher Management Configuration"
            description="Configure teacher-related settings and defaults"
            fields={teacherSettingsFields}
            initialValues={initialSettings}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </PermissionGuard>
  );
}