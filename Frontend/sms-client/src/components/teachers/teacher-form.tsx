'use client';

import { useState, useEffect } from 'react';
import { Teacher, TeacherCreate, TeacherUpdate, TeacherCreateResponse } from '@/types/teacher';
import { useCreateTeacher, useUpdateTeacher } from '@/hooks/queries/teachers';
import { AppError } from '@/utils/error-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TeacherFormFields } from './teacher-form-fields';
import { TeacherCredentialsDisplay } from './teacher-credentials-display';
import { toast } from 'sonner';

interface TeacherFormProps {
  teacher?: Teacher;
  onSave?: (teacher: Teacher) => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
}

export default function TeacherForm({ teacher, onSave, onCancel, mode = 'create' }: TeacherFormProps) {
  const [formData, setFormData] = useState<TeacherCreate | TeacherUpdate>({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    department: '',
    qualification: '',
    joining_date: '',
    is_class_teacher: false,
    address: '',
    city: '',
    county: '',
    country: '',
    gender: '',
    whatsapp_number: '',
  });

  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedTeacher, setSavedTeacher] = useState<Teacher | null>(null);

  const createTeacherMutation = useCreateTeacher();
  const updateTeacherMutation = useUpdateTeacher();

  useEffect(() => {
    if (teacher && mode === 'edit') {
      setFormData({
        email: teacher.email,
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        phone_number: teacher.phone_number || '',
        department: teacher.department || '',
        qualification: teacher.qualification || '',
        joining_date: teacher.joining_date || '',
        is_class_teacher: teacher.is_class_teacher,
        address: teacher.address || '',
        city: teacher.city || '',
        county: teacher.county || '',
        country: teacher.country || '',
        gender: teacher.gender || '',
        whatsapp_number: teacher.whatsapp_number || '',
      });
    }
  }, [teacher, mode]);

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Simple client-side validation
    if (!formData.first_name || !formData.last_name || !formData.email) {
      toast.error('First name, last name, and email are required');
      return;
    }

    try {
      if (mode === 'create') {
        const teacherCreateData: TeacherCreate & { password: string } = {
          email: formData.email!,
          first_name: formData.first_name!,
          last_name: formData.last_name!,
          phone_number: formData.phone_number || undefined,
          department: formData.department,
          qualification: formData.qualification,
          joining_date: formData.joining_date,
          is_class_teacher: formData.is_class_teacher || false,
          address: formData.address,
          city: formData.city,
          county: formData.county,
          country: formData.country,
          gender: formData.gender,
          whatsapp_number: formData.whatsapp_number,
          password: '' // Backend will auto-generate if empty
        };

        createTeacherMutation.mutate(teacherCreateData, {
          onSuccess: (response: any) => {
            // response is TeacherCreateResponse
            setSavedTeacher(response);

            if (response.generated_password) {
              setGeneratedPassword(response.generated_password);
              setShowSuccess(true);
              // Auto-hide after 3 minutes
              setTimeout(() => {
                setGeneratedPassword(null);
                setShowSuccess(false);
              }, 180000);
            } else {
              onSave?.(response);
            }
          },
          onError: (error) => {
            // Error already handled by toast in most cases, but we can set form error if needed
            // Using toast for consistency
            const msg = error instanceof AppError ? error.message : "Failed to create teacher";
            // toast.error(msg); // Let parent or global handler check this? 
            // Ideally localized error
            console.error(msg);
          }
        });

      } else {
        // Edit mode
        updateTeacherMutation.mutate({ id: teacher!.id, teacher: formData as TeacherUpdate }, {
          onSuccess: (response) => {
            onSave?.(response);
          }
        });
      }

    } catch (err) {
      console.error('Unexpected error in form submission:', err);
    }
  };

  const handleDone = () => {
    setGeneratedPassword(null);
    setShowSuccess(false);
    if (savedTeacher) {
      onSave?.(savedTeacher);
    }
  };

  const isPending = createTeacherMutation.isPending || updateTeacherMutation.isPending;
  const isError = createTeacherMutation.isError || updateTeacherMutation.isError;
  const errorMsg = createTeacherMutation.error?.message || updateTeacherMutation.error?.message;

  return (
    <div className="space-y-6">
      {/* Success Message with Generated Password */}
      {showSuccess && generatedPassword && (
        <TeacherCredentialsDisplay
          email={formData.email || ''}
          generatedPassword={generatedPassword}
          whatsappNumber={formData.whatsapp_number}
          onDone={handleDone}
        />
      )}

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle>{mode === 'create' ? 'Create New Teacher' : 'Edit Teacher'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isError && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <TeacherFormFields
              formData={formData}
              onInputChange={handleInputChange}
            // mode={mode}
            />

            <div className="flex justify-end space-x-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                <Save className="w-4 h-4 mr-2" />
                {isPending ? 'Saving...' : mode === 'create' ? 'Create Teacher' : 'Update Teacher'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
