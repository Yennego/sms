'use client';

import { Fragment, useRef, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserWithRoles } from '@/services/api/super-admin-service';

interface UserEditModalProps {
  isOpen: boolean;
  user: UserWithRoles | null;
  isLoading?: boolean;
  onSave: (userData: { first_name: string; last_name: string; email: string }) => void;
  onCancel: () => void;
}

export default function UserEditModal({
  isOpen,
  user,
  isLoading = false,
  onSave,
  onCancel,
}: UserEditModalProps) {
  const cancelButtonRef = useRef(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || ''
      });
      setErrors({});
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || ''
    });
    setErrors({});
    onCancel();
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" initialFocus={cancelButtonRef} onClose={handleCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                      <User className="h-6 w-6 text-blue-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Edit User
                      </Dialog.Title>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                            First Name
                          </label>
                          <Input
                            id="first_name"
                            type="text"
                            value={formData.first_name}
                            onChange={(e) => handleInputChange('first_name', e.target.value)}
                            className={errors.first_name ? 'border-red-500' : ''}
                            disabled={isLoading}
                          />
                          {errors.first_name && (
                            <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>
                          )}
                        </div>
                        
                        <div>
                          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name
                          </label>
                          <Input
                            id="last_name"
                            type="text"
                            value={formData.last_name}
                            onChange={(e) => handleInputChange('last_name', e.target.value)}
                            className={errors.last_name ? 'border-red-500' : ''}
                            disabled={isLoading}
                          />
                          {errors.last_name && (
                            <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>
                          )}
                        </div>
                        
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className={errors.email ? 'border-red-500' : ''}
                            disabled={isLoading}
                          />
                          {errors.email && (
                            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:ml-3 sm:w-auto"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    ref={cancelButtonRef}
                    disabled={isLoading}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}