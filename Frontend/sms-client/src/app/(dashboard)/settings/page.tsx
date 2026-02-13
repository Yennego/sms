'use client';

import Link from 'next/link';

export default function SettingsPage() {
  const settingsCategories = [
    {
      title: 'System Settings',
      description: 'Configure global system settings and defaults',
      href: '/settings/system'
    },
    {
      title: 'Tenant Settings',
      description: 'Manage tenant-specific configuration',
      href: '/settings/tenant'
    },
    {
      title: 'User Settings',
      description: 'Configure user preferences and defaults',
      href: '/settings/user'
    },
    {
      title: 'Student Settings',
      description: 'Configure student-related settings',
      href: '/settings/student'
    },
    {
      title: 'Teacher Settings',
      description: 'Configure teacher-related settings',
      href: '/settings/teacher'
    },
    {
      title: 'Timetable Settings',
      description: 'Configure timetable generation and display',
      href: '/settings/timetable'
    },
    {
      title: 'Communication Settings',
      description: 'Configure messaging and notification settings',
      href: '/settings/communication'
    },
    {
      title: 'WhatsApp Settings',
      description: 'Configure WhatsApp notifications and templates',
      href: '/settings/whatsapp'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => (
          <Link key={category.href} href={category.href}>
            <div className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
              <h2 className="text-xl font-semibold mb-2">{category.title}</h2>
              <p className="text-gray-600">{category.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}