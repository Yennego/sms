'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';

export default function StudentSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const initialSettings = {
    admissionNumberPrefix: 'STU',
    admissionNumberDigits: 6,
    autoGenerateEmail: true,
    emailDomain: 'students.school.com',
    defaultAttendanceStatus: 'present',
    attendanceCutoffTime: '10:00',
    allowParentAccess: true,
    maxAbsencesBeforeAlert: 3,
    enableBehaviorTracking: true,
    enableAchievementTracking: true
  };
  
  const studentSettingsFields = [
    {
      id: 'admissionNumberPrefix',
      label: 'Admission Number Prefix',
      type: 'text' as const,
      placeholder: 'Enter prefix for student IDs'
    },
    {
      id: 'admissionNumberDigits',
      label: 'Admission Number Digits',
      type: 'number' as const,
      placeholder: 'Enter number of digits'
    },
    {
      id: 'autoGenerateEmail',
      label: 'Auto-generate Student Email',
      type: 'checkbox' as const
    },
    {
      id: 'emailDomain',
      label: 'Student Email Domain',
      type: 'text' as const,
      placeholder: 'Enter email domain'
    },
    {
      id: 'defaultAttendanceStatus',
      label: 'Default Attendance Status',
      type: 'select' as const,
      options: [
        { value: 'present', label: 'Present' },
        { value: 'absent', label: 'Absent' },
        { value: 'late', label: 'Late' }
      ]
    },
    {
      id: 'attendanceCutoffTime',
      label: 'Attendance Cutoff Time',
      type: 'text' as const,
      placeholder: 'HH:MM format'
    },
    {
      id: 'allowParentAccess',
      label: 'Allow Parent Portal Access',
      type: 'checkbox' as const
    },
    {
      id: 'maxAbsencesBeforeAlert',
      label: 'Max Absences Before Alert',
      type: 'number' as const,
      placeholder: 'Enter number'
    },
    {
      id: 'enableBehaviorTracking',
      label: 'Enable Behavior Tracking',
      type: 'checkbox' as const
    },
    {
      id: 'enableAchievementTracking',
      label: 'Enable Achievement Tracking',
      type: 'checkbox' as const
    }
  ];
  
  const handleSubmit = (values: Record<string, string | boolean | number>) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log('Student settings saved:', values);
      setIsLoading(false);
    }, 1000);
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Student Settings</h1>
        
        <div className="space-y-8">
          <SettingsForm
            title="Student Management Configuration"
            description="Configure student-related settings and defaults"
            fields={studentSettingsFields}
            initialValues={initialSettings}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </PermissionGuard>
  );
}