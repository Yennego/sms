'use client';

import { useState, useEffect } from 'react';
import { Tenant, TenantCreate, TenantUpdate } from '@/types/tenant';
import { useTenantService } from '@/services/api/tenant-service';
import { AppError } from '@/utils/error-utils';
import Link from 'next/link';
import { useBillingSchool } from '@/components/billing/queries';
import { BillingStatusBadge } from '@/components/billing/shared';
import { anyPositive, formatPair } from '@/components/fees/money';
import { isReservedSlug } from '@/config/reserved-slugs';

// A school's address is app-host/{slug}; the slug is Domain, or Subdomain when Domain is empty.
// Same rules as the backend (src/core/constants/reserved_slugs.py); it stores them in lower case.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 63;

function slugProblem(value: string | undefined, what: string): string | null {
  const slug = (value ?? '').trim().toLowerCase();
  if (!slug) return null;
  if (slug.length > SLUG_MAX_LENGTH) return `${what} must be at most ${SLUG_MAX_LENGTH} characters`;
  if (!SLUG_PATTERN.test(slug)) {
    return `${what} can only use lowercase letters, numbers and hyphens, and can't start or end with a hyphen`;
  }
  if (isReservedSlug(slug)) return `${what} "${slug}" is used by the app. Choose another.`;
  return null;
}

interface TenantFormProps {
  tenant: Tenant | null;
  onClose: () => void;
  onSubmit: (tenant?: Tenant | TenantCreate) => void;
  isWizardMode?: boolean;
}

export default function TenantForm({ tenant, onClose, onSubmit, isWizardMode = false }: TenantFormProps) {
  const [formData, setFormData] = useState<TenantCreate | TenantUpdate>({
    name: '',
    code: '',
    domain: '',
    subdomain: '',
    logo: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The app's own host, for the address preview (set after mount, so server and client render alike)
  const [appHost, setAppHost] = useState('');
  useEffect(() => setAppHost(window.location.host), []);

  const tenantService = useTenantService();
  const billing = useBillingSchool(tenant?.id);

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name,
        code: tenant.code || '',
        domain: tenant.domain || '',
        subdomain: tenant.subdomain || '',
        logo: tenant.logo ? tenant.logo.replace(/`/g, '') : '',
        primaryColor: tenant.primaryColor || '#3B82F6',
        secondaryColor: tenant.secondaryColor || '#1E40AF',
        isActive: tenant.isActive,
      });
    }
  }, [tenant]);

  // When setting the logo URL, ensure it doesn't contain backticks
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    // Clean URL if it's the logo field
    let finalValue = value;
    if (name === 'logo' && typeof value === 'string') {
      // Remove any backticks from the URL
      finalValue = value.replace(/`/g, '');
    }

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : finalValue,
    });
  };

  // Add this function before the handleSubmit function
  const validateForm = (): string | null => {
    if (!formData.name || formData.name.length < 3) {
      return 'School name must be at least 3 characters long';
    }

    if (!formData.code || formData.code.length < 2) {
      return 'School code must be at least 2 characters long';
    }

    if (!/^[a-zA-Z0-9]+$/.test(formData.code)) {
      return 'School code can only use letters and numbers';
    }

    const addressProblem =
      slugProblem(formData.domain, 'School address') ?? slugProblem(formData.subdomain, 'Second address');
    if (addressProblem) return addressProblem;

    return null;
  };

  // Then modify the beginning of handleSubmit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Clean the logo URL before submission
    const cleanedFormData = {
      ...formData,
      logo: formData.logo ? formData.logo.trim().replace(/`/g, '') : formData.logo
    };

    setIsLoading(true);
    setError('');

    try {
      if (tenant) {
        // Update existing tenant
        const updatedTenant = await tenantService.updateTenant(tenant.id, cleanedFormData);
        console.log('Tenant updated successfully:', updatedTenant);
        onSubmit();
      } else if (isWizardMode) {
        // In wizard mode, just collect the data without creating the tenant
        console.log('Collecting tenant data for atomic creation:', cleanedFormData);
        onSubmit(cleanedFormData as TenantCreate);
        return; // Don't set loading to false here since we're not done
      } else {
        // Create new tenant immediately (non-wizard mode)
        const newTenant = await tenantService.createTenant(cleanedFormData as TenantCreate);
        console.log('Tenant created successfully:', newTenant);
        onSubmit();
      }
    } catch (err: unknown) {
      console.error('Error saving tenant:', err);

      let errorMessage = "Couldn't save the school. Please try again.";

      // Enhanced error handling
      if (err instanceof AppError) {
        console.error('AppError details:', {
          type: err.type,
          statusCode: err.statusCode,
          message: err.message
        });

        // Use the AppError message as it might contain validation details
        errorMessage = err.message;

        // Try to extract more specific validation errors
        if (err.originalError && typeof err.originalError === 'object') {
          const originalError = err.originalError as Record<string, unknown>;
          if (originalError && 'response' in originalError) {
            const response = originalError.response as Record<string, unknown>;
            console.log('Response data:', response);

            if (response && 'data' in response && typeof response.data === 'object') {
              const data = response.data as Record<string, unknown>;
              console.log('Error data:', data);

              if ('detail' in data && typeof data.detail === 'string') {
                // Use the specific validation error message
                errorMessage = data.detail;
              } else if ('detail' in data && Array.isArray(data.detail)) {
                // Handle array of validation errors
                const details = data.detail as Array<{ loc: string[], msg: string, type: string }>;
                if (details.length > 0) {
                  errorMessage = details.map(d => d.msg).join(', ');
                }
              }
            }
          }
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {tenant ? 'Edit school' : 'Create school'}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Basic Information Section */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Basic information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                    placeholder="Enter the school's name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code * (unique identifier)
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    pattern="[a-zA-Z0-9]+"
                    minLength={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                    placeholder="e.g., ACME123"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Letters and numbers only, at least 2 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School logo
                  </label>
                  <div className="flex items-center space-x-4">
                    {formData.logo ? (
                      <div className="relative w-16 h-16 border rounded-lg overflow-hidden bg-gray-50">
                        <img
                          src={formData.logo}
                          alt="Logo preview"
                          className="object-contain w-full h-full"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, logo: '' })}
                          aria-label="Remove logo"
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-1 hover:bg-red-600 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        id="logo-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          setIsLoading(true);
                          setError(null);
                          try {
                            const result = await tenantService.uploadLogo(file);
                            setFormData({ ...formData, logo: result.url });
                          } catch (err) {
                            console.error('Upload failed:', err);
                            setError('Failed to upload logo. Please try again.');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                      />
                      <label
                        htmlFor="logo-upload"
                        className={`inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isLoading ? 'Uploading...' : 'Choose logo file'}
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG, WebP up to 5MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* School address (the Domain field; Subdomain when Domain is empty) */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200">
                School address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="tenant-domain" className="block text-sm font-medium text-gray-700 mb-2">
                    School address
                  </label>
                  <div className="flex min-w-0 items-stretch rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                    <span className="flex max-w-[50%] shrink-0 items-center truncate rounded-l-lg border-r border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                      {appHost || 'app'}/
                    </span>
                    <input
                      id="tenant-domain"
                      type="text"
                      name="domain"
                      value={formData.domain}
                      onChange={handleChange}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-describedby="tenant-domain-hint"
                      className="min-w-0 flex-1 rounded-r-lg px-3 py-3 focus:outline-none"
                      placeholder="top-foundation"
                    />
                  </div>
                  <p id="tenant-domain-hint" className="text-xs text-gray-500 mt-1">
                    Only lowercase letters, numbers and hyphens, e.g. top-foundation. Staff, students and parents
                    sign in at this address.
                  </p>
                </div>

                <div>
                  <label htmlFor="tenant-subdomain" className="block text-sm font-medium text-gray-700 mb-2">
                    Second address (optional)
                  </label>
                  <input
                    id="tenant-subdomain"
                    type="text"
                    name="subdomain"
                    value={formData.subdomain}
                    onChange={handleChange}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-describedby="tenant-subdomain-hint"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                    placeholder="topfoundation"
                  />
                  <p id="tenant-subdomain-hint" className="text-xs text-gray-500 mt-1">
                    Used as the address only when School address is empty. Same rules.
                  </p>
                </div>
              </div>
              {(() => {
                const slug = (formData.domain || formData.subdomain || '').trim().toLowerCase();
                return slug ? (
                  <p className="mt-3 break-all text-sm text-gray-700">
                    The school&apos;s address will be{' '}
                    <span className="font-mono font-medium">{appHost || 'app'}/{slug}</span>
                  </p>
                ) : null;
              })()}
            </div>

            {/* Billing: one platform price list for every school (phase7-design.md §1), so nothing to set here */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Billing
              </h3>
              {tenant ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                  {billing.data ? <BillingStatusBadge status={billing.data.subscription.status} /> : null}
                  {billing.data && anyPositive(billing.data.amount_due) ? (
                    <span>Amount due: {formatPair(billing.data.amount_due)}</span>
                  ) : null}
                  <Link href={`/platform/billing/schools/${tenant.id}`} className="font-medium text-indigo-600 hover:text-indigo-900">
                    Open billing
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Every school uses the platform price list. A new school&apos;s first term is free.
                </p>
              )}
            </div>

            {/* Branding Section */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Branding and colors
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      name="primaryColor"
                      value={formData.primaryColor}
                      onChange={handleChange}
                      className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => handleChange({ ...e, target: { ...e.target, name: 'primaryColor' } })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      name="secondaryColor"
                      value={formData.secondaryColor}
                      onChange={handleChange}
                      className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) => handleChange({ ...e, target: { ...e.target, name: 'secondaryColor' } })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      placeholder="#1E40AF"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center lg:justify-start">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Active
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </div>
                ) : (
                  tenant ? 'Save changes' :
                    isWizardMode ? 'Next: admin setup' : 'Create school'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}