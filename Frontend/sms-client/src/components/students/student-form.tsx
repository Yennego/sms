'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Save, X, User } from 'lucide-react';
import ImageUpload from '@/components/common/ImageUpload';
import { useStudentService } from '@/services/api/student-service';
import { toast } from 'sonner';
import { useCreateStudent, useUpdateStudent } from '@/hooks/queries/students';

import { BasicInfoSection } from './sections/BasicInfoSection';
import AcademicInfoSection from './sections/AcademicInfoSection';
import { PersonalInfoSection } from './sections/PersonalInfoSection';
import { ContactInfoSection } from './sections/ContactInfoSection';
import { AddressInfoSection } from './sections/AddressInfoSection';
import { Student } from '@/types/student';

interface StudentFormProps {
  studentId?: string;
  student?: Student;
  mode?: 'create' | 'edit';
  onClose?: () => void;
  onSuccess?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

interface FormData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  nationality: string;
  religion: string;

  // Academic info
  admissionNumber: string;
  rollNumber: string;
  admissionDate: string;

  // Contact Information
  whatsappNumber: string;
  emergencyContact: string;

  // Address Information
  address: string;
  city: string;
  county: string;
  country: string;
  photo: string;
}

interface FormErrors {
  [key: string]: string;
}

const initialFormData: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  admissionNumber: '',
  rollNumber: '',
  admissionDate: '',
  dateOfBirth: '',
  gender: '',
  bloodGroup: '',
  nationality: '',
  religion: '',
  whatsappNumber: '',
  emergencyContact: '',
  address: '',
  city: '',
  county: '',
  country: '',
  photo: ''
};

export default function StudentForm({ studentId, student, mode, onClose, onSuccess, onSave, onCancel }: StudentFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [manualError, setManualError] = useState<string | null>(null);

  const studentService = useStudentService();
  const createStudentMutation = useCreateStudent();
  const updateStudentMutation = useUpdateStudent();

  // Loading state for fetching initial data handled manually since we use a service call in useEffect
  // or we could use useStudent hook. Let's stick to service for now to minimize changes to data loading logic 
  // unless I refactor that too. I'll stick to service for fetching for now to be safe.
  const [fetchingLoading, setFetchingLoading] = useState(false);

  const isPending = createStudentMutation.isPending || updateStudentMutation.isPending || fetchingLoading;
  const errorMsg = manualError || createStudentMutation.error?.message || updateStudentMutation.error?.message;

  // Restore helper functions
  const mapStudentToFormData = React.useCallback((student: Partial<Student>): FormData => {
    return {
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      email: student.email || '',
      phoneNumber: student.phone || '',
      admissionNumber: student.admission_number || '',
      rollNumber: student.roll_number?.toString() || '',
      admissionDate: student.admission_date || '',
      dateOfBirth: student.date_of_birth || '',
      gender: student.gender || '',
      bloodGroup: student.blood_group || '',
      nationality: student.nationality || '',
      religion: student.religion || '',
      whatsappNumber: student.whatsapp_number || '',
      emergencyContact: student.emergency_contact || '',
      address: student.address || '',
      city: student.city || '',
      county: student.county || '',
      country: student.country || '',
      photo: student.photo || ''
    };
  }, []);

  const loadStudentData = React.useCallback(async () => {
    try {
      setFetchingLoading(true);
      const studentData = await studentService.getStudentById(studentId!);
      setFormData(mapStudentToFormData(studentData));
    } catch (err) {
      setManualError('Failed to load student data');
      console.error('Error loading student data:', err);
    } finally {
      setFetchingLoading(false);
    }
  }, [studentId, studentService, mapStudentToFormData]);

  const loadStudentFromObject = React.useCallback((studentObj: Partial<Student>) => {
    setFormData(mapStudentToFormData(studentObj));
  }, [mapStudentToFormData]);

  useEffect(() => {
    if (studentId) {
      loadStudentData();
    } else if (student) {
      loadStudentFromObject(student);
    }
  }, [studentId, student, loadStudentData, loadStudentFromObject]);

  const mapFormDataToBackend = (formData: FormData) => {
    return {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email || undefined,
      phone_number: formData.phoneNumber || undefined,
      admission_number: formData.admissionNumber,
      roll_number: formData.rollNumber ? parseInt(formData.rollNumber) : undefined,
      admission_date: formData.admissionDate || undefined,
      date_of_birth: formData.dateOfBirth,
      gender: formData.gender,
      blood_group: formData.bloodGroup || undefined,
      nationality: formData.nationality || undefined,
      religion: formData.religion || undefined,
      whatsapp_number: formData.whatsappNumber || undefined,
      emergency_contact: formData.emergencyContact,
      address: formData.address,
      city: formData.city,
      county: formData.county || undefined,
      country: formData.country,
      photo: formData.photo || undefined
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value || '' }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  function validateForm(): boolean {
    const newErrors: FormErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.admissionNumber.trim()) newErrors.admissionNumber = 'Admission number is required';
    if (!formData.admissionDate) newErrors.admissionDate = 'Admission date is required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.emergencyContact.trim()) newErrors.emergencyContact = 'Emergency contact is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.country.trim()) newErrors.country = 'Country is required';

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const backendData = mapFormDataToBackend(formData);

    if (studentId || (student && mode === 'edit')) {
      const idToUse = studentId ?? (student?.id ?? '');
      if (!idToUse) {
        toast.error('Missing student id for update');
        return;
      }

      updateStudentMutation.mutate({ id: idToUse, student: backendData }, {
        onSuccess: () => {
          toast.success('Student updated successfully');
          onSuccess?.();
          onSave?.();
          onClose?.();
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Failed to update student';
          setManualError(message);
          toast.error(message);
        }
      });
    } else {
      const createData = {
        ...backendData,
        email: formData.email || `st-${formData.admissionNumber}@school.stub` // Fallback if no email
      };

      createStudentMutation.mutate(createData as any, { // Type cast if needed, or ensure mapping matches
        onSuccess: () => {
          toast.success('Student created successfully');
          onSuccess?.();
          onSave?.();
          onClose?.();
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Failed to create student';
          setManualError(message);
          toast.error(message);
        }
      });
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setErrors({});
    setManualError(null);
    onClose?.();
    onCancel?.();
  };

  if (fetchingLoading && (studentId || student)) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">Loading student data...</div>
        </CardContent>
      </Card>
    );
  }

  const isEditMode = studentId || (student && mode === 'edit');

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Student' : 'Add New Student'}</CardTitle>
      </CardHeader>
      <CardContent>
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Upload Section */}
          <div className="flex flex-col md:flex-row gap-6 items-start pb-4">
            <div className="w-full md:w-1/3 text-center">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student Photo
              </label>
              <div className="flex justify-center">
                <ImageUpload
                  value={formData.photo}
                  onChange={(url) => setFormData(prev => ({ ...prev, photo: url }))}
                  folder="student-photos"
                  placeholder="Upload student photo"
                  aspectRatio="square"
                  className="w-full max-w-[200px]"
                />
              </div>
              <p className="mt-2 text-xs text-gray-400 font-normal italic">
                JPG, PNG or WebP. Max 5MB.
              </p>
            </div>
            <div className="flex-1 w-full pt-6 md:pt-8 bg-gray-50/50 p-4 rounded-lg border border-gray-100 self-center">
              <div className="flex items-center gap-3 text-gray-600 mb-2">
                <User className="w-5 h-5" />
                <span className="font-semibold text-gray-800">Profile Image</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                A clear, formal photograph helps identify the student easily. This photo will be displayed on the student's profile, digital ID cards, and attendance reports.
              </p>
            </div>
          </div>

          <Separator />

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Basic Information</h3>
            <BasicInfoSection
              formData={formData}
              handleInputChange={handleInputChange}
              errors={errors}
            />
          </div>

          <Separator />

          {/* Academic Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Academic Information</h3>
            <AcademicInfoSection
              formData={formData}
              handleInputChange={handleInputChange}
              errors={errors}
            />
          </div>

          <Separator />

          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Personal Information</h3>
            <PersonalInfoSection
              formData={formData}
              handleInputChange={handleInputChange}
              handleSelectChange={handleSelectChange}
              errors={errors}
            />
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Contact Information</h3>
            <ContactInfoSection
              formData={formData}
              handleInputChange={handleInputChange}
              errors={errors}
            />
          </div>

          <Separator />

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Address Information</h3>
            <AddressInfoSection
              formData={formData}
              handleInputChange={handleInputChange}
              errors={errors}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="w-4 h-4 mr-2" />
              {isPending ? 'Saving...' : (isEditMode ? 'Update Student' : 'Create Student')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
