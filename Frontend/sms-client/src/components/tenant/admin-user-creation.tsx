'use client';

import { useState } from 'react';
import { Tenant } from '@/types/tenant';
import { useSuperAdminService, UserCreateCrossTenant, UserCreateResponse } from '@/services/api/super-admin-service';

interface AdminUserCreationProps {
  tenant: Tenant | null; 
  onBack: () => void;
  onAdminCreated: (credentials: {
    email: string;
    password: string;
    username: string;
    tenantLoginUrl: string;
    userId: string;
  } | {
    first_name: string;
    last_name: string;
    email: string;
    password?: string;
  }) => void;
  onCancel: () => void;
  isCreating?: boolean; // For showing loading state during atomic creation
}

interface AdminUserForm {
  firstName: string;
  lastName: string;
  email: string;
  generatePassword: boolean;
  customPassword?: string;
}

export default function AdminUserCreation({ 
  tenant, 
  onBack, 
  onAdminCreated, 
  onCancel,
  isCreating = false
}: AdminUserCreationProps) {
  const [formData, setFormData] = useState<AdminUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    generatePassword: true,
    customPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const superAdminService = useSuperAdminService();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    if (!formData.generatePassword && (!formData.customPassword || formData.customPassword.length < 8)) {
      return 'Custom password must be at least 8 characters long';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // If tenant is null, we're in data collection mode for atomic creation
    if (!tenant) {
      const adminUserData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.generatePassword ? undefined : formData.customPassword
      };
      
      console.log('Collecting admin user data for atomic creation:', { 
        ...adminUserData, 
        password: adminUserData.password ? '[HIDDEN]' : undefined 
      });
      
      onAdminCreated(adminUserData);
      return;
    }

    // Original immediate creation mode
    setIsLoading(true);
    setError(null);

    try {
      // Prepare user data for backend
      const adminUserData: UserCreateCrossTenant = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        role: 'admin',
        tenant_id: tenant.id || '',
        is_active: true,
        password: formData.generatePassword ? '' : (formData.customPassword || '')
      };
  
      // Validate tenant ID before making the request
      if (!tenant.id) {
        throw new Error('Tenant ID is required but not provided');
      }
  
      console.log('Creating admin user with data:', adminUserData);
      console.log('Password being sent:', adminUserData.password);
      console.log('Generate password flag:', formData.generatePassword);
  
      // Call backend API using axios (through super admin service)
      const response: UserCreateResponse = await superAdminService.createUserCrossTenant(adminUserData);
  
      console.log('User creation response from backend:', response);
      console.log('Generated password from response:', response.generated_password);
      console.log('Custom password from form:', formData.customPassword);
  
      // Extract password from backend response
      const finalPassword = response.generated_password || formData.customPassword || '';
      console.log('Final password determined:', finalPassword ? '[PASSWORD_SET]' : '[NO_PASSWORD]');
      
      if (!finalPassword) {
        throw new Error('No password received from backend');
      }
      
      // Generate tenant-specific login URL
      const tenantLoginUrl = tenant?.domain 
        ? `https://${tenant.domain}/login`
        : tenant?.subdomain 
        ? `https://${tenant.subdomain}.yourdomain.com/login`
        : tenant?.code
        ? `https://yourdomain.com/${tenant.code}/login`
        : 'https://yourdomain.com/login';

      const credentials = {
        email: formData.email,
        password: finalPassword,
        username: formData.email,
        tenantLoginUrl,
        userId: response.id
      };

      console.log('Passing credentials to parent:', { ...credentials, password: '[HIDDEN]' });
      onAdminCreated(credentials);
      
    } catch (err) {
      console.error('Error creating admin user:', err);
      
      // Enhanced error handling for axios errors
      let errorMessage = 'Failed to create admin user';
      
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { 
          response?: { 
            data?: { 
              detail?: string; 
              message?: string 
            } 
          }; 
          message?: string 
        };
        
        if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        } else if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Create Admin User{tenant ? ` for ${tenant.name}` : ''}
        </h3>
        <p className="text-sm text-gray-600">
          Set up the initial administrator account for this tenant. This user will have full administrative access to manage the tenant.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="border rounded-md p-4 bg-gray-50">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                name="generatePassword"
                checked={formData.generatePassword}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Generate secure password automatically (Recommended)
              </label>
            </div>
            
            {!formData.generatePassword && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Password *
                </label>
                <input
                  type="password"
                  name="customPassword"
                  value={formData.customPassword}
                  onChange={handleChange}
                  required={!formData.generatePassword}
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Minimum 8 characters"
                />
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-2">
              {formData.generatePassword 
                ? 'A secure password will be generated automatically by the system.'
                : 'Please ensure your password is strong and secure.'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isLoading}
          >
            Back
          </button>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isLoading || isCreating}
            >
              {isCreating ? 'Creating Tenant & Admin...' : 
               isLoading ? 'Creating...' : 
               tenant ? 'Create Admin User' : 'Create Tenant & Admin'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}