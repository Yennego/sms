'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import SettingsForm from '@/components/settings/settings-form';

export default function TimetableSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const initialSettings = {
    defaultDuration: 45,
    periodsPerDay: 8,
    startTime: '08:00',
    endTime: '15:30',
    breakDuration: 15,
    lunchDuration: 45,
    showWeekends: false,
    autoAssignTeachers: true,
    conflictDetection: true
  };
  
  const timetableSettingsFields = [
    {
      id: 'defaultDuration',
      label: 'Default Period Duration (minutes)',
      type: 'number' as const,
      placeholder: 'Enter duration in minutes'
    },
    {
      id: 'periodsPerDay',
      label: 'Periods Per Day',
      type: 'number' as const,
      placeholder: 'Enter number of periods'
    },
    {
      id: 'startTime',
      label: 'School Day Start Time',
      type: 'text' as const,
      placeholder: 'HH:MM format'
    },
    {
      id: 'endTime',
      label: 'School Day End Time',
      type: 'text' as const,
      placeholder: 'HH:MM format'
    },
    {
      id: 'breakDuration',
      label: 'Break Duration (minutes)',
      type: 'number' as const,
      placeholder: 'Enter duration in minutes'
    },
    {
      id: 'lunchDuration',
      label: 'Lunch Break Duration (minutes)',
      type: 'number' as const,
      placeholder: 'Enter duration in minutes'
    },
    {
      id: 'showWeekends',
      label: 'Include Weekends in Timetable',
      type: 'checkbox' as const
    },
    {
      id: 'autoAssignTeachers',
      label: 'Auto-assign Teachers When Possible',
      type: 'checkbox' as const
    },
    {
      id: 'conflictDetection',
      label: 'Enable Conflict Detection',
      type: 'checkbox' as const
    }
  ];
  
  const handleSubmit = (values: Record<string, string | boolean | number>) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log('Timetable settings saved:', values);
      setIsLoading(false);
    }, 1000);
  };
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Timetable Settings</h1>
        
        <div className="space-y-8">
          <SettingsForm
            title="Timetable Configuration"
            description="Configure timetable generation and display settings"
            fields={timetableSettingsFields}
            initialValues={initialSettings}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </PermissionGuard>
  );
}