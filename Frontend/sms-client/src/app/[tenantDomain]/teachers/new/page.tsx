'use client';

import TeacherForm from '@/components/teachers/teacher-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { Teacher } from '@/types/teacher';
import { useTenantNavigation } from '@/hooks/use-tenant';

export default function NewTeacherPage() {
  const router = useRouter();
  const { createTenantPath } = useTenantNavigation();

  const handleCreateSuccess = (teacher: Teacher) => {
    void teacher;
    router.push(createTenantPath('/teachers'));
  };

  const handleCancel = () => {
    router.push(createTenantPath('/teachers'));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.push(createTenantPath('/teachers'))}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Teachers
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Add New Teacher</h1>
        <p className="text-gray-600 mt-1">Create a new teacher profile</p>
      </div>

      <TeacherForm
        mode="create"
        onSave={handleCreateSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
