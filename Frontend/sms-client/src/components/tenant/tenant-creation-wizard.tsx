'use client';

import React, { useState } from 'react';
import { TenantCreate, TenantCreateWithAdmin, AdminUserData, TenantCreateResponse } from '@/types/tenant';
import TenantForm from './tenant-form';
import AdminUserCreation from './admin-user-creation';
import CredentialDisplay from './credential-display';
import { useTenantService } from '@/services/api/tenant-service';

type WizardStep = 'tenant' | 'admin' | 'credentials';

interface TenantCreationWizardProps {
  onClose: () => void;
  onComplete: () => void;
}


export default function TenantCreationWizard({ onClose, onComplete }: TenantCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('tenant');
  const [tenantData, setTenantData] = useState<TenantCreate | null>(null);
  const [createdResult, setCreatedResult] = useState<TenantCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const tenantService = useTenantService();

  const handleTenantDataCollected = (tenant: TenantCreate) => {
    console.log('Tenant data collected:', tenant);
    setTenantData(tenant);
    setCurrentStep('admin');
    setError(null);
  };

  const handleAdminDataCollected = async (adminUserData: AdminUserData) => {
    if (!tenantData) {
      setError('Tenant data is missing. Please go back and fill the tenant form.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const tenantWithAdmin: TenantCreateWithAdmin = {
        ...tenantData,
        admin_user: adminUserData
      };

      console.log('Creating tenant with admin atomically:', { 
        ...tenantWithAdmin, 
        admin_user: { ...adminUserData, password: '[HIDDEN]' } 
      });

      const result = await tenantService.createTenantWithAdmin(tenantWithAdmin);
      
      console.log('Tenant and admin created successfully:', {
        ...result,
        admin_user: { ...result.admin_user, generated_password: '[HIDDEN]' }
      });

      setCreatedResult(result);
      setCurrentStep('credentials');
    } catch (error: unknown) {
      console.error('Failed to create tenant with admin:', error);
      const message = error instanceof Error ? error.message : 'Failed to create tenant and admin user. Please try again.';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = () => {
    console.log('Tenant creation wizard completed');
    onComplete();
    onClose();
  };

  const handleBack = (step: WizardStep) => {
    setCurrentStep(step);
    setError(null);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'tenant':
        return (
          <TenantForm
            tenant={null}
            onClose={onClose}
            onSubmit={handleTenantDataCollected}
            isWizardMode={true}
          />
        );
      case 'admin':
        return (
          <AdminUserCreation
            tenant={null} // We don't have a created tenant yet
            onBack={() => handleBack('tenant')}
            onAdminCreated={handleAdminDataCollected}
            onCancel={onClose}
            isCreating={isCreating}
          />
        );
      case 'credentials':
        if (!createdResult) {
          return <div className="p-6">Error: No creation result available</div>;
        }
        
        const credentials = {
          email: createdResult.admin_user.email,
          password: createdResult.admin_user.generated_password || '[Password was set by user]',
          username: createdResult.admin_user.email,
          tenantLoginUrl: createdResult.tenant.domain 
            ? `https://${createdResult.tenant.domain}` 
            : `https://${createdResult.tenant.subdomain}.yourdomain.com`,
          userId: createdResult.admin_user.id
        };
        
        return (
          <CredentialDisplay
            tenant={createdResult.tenant}
            credentials={credentials}
            onComplete={handleComplete}
            onBack={() => handleBack('admin')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Progress indicator */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Create New Tenant</h2>
            <div className="flex space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                currentStep === 'tenant' ? 'bg-blue-600' : 
                ['admin', 'credentials'].includes(currentStep) ? 'bg-green-600' : 'bg-gray-300'
              }`} />
              <div className={`w-3 h-3 rounded-full ${
                currentStep === 'admin' ? 'bg-blue-600' : 
                currentStep === 'credentials' ? 'bg-green-600' : 'bg-gray-300'
              }`} />
              <div className={`w-3 h-3 rounded-full ${
                currentStep === 'credentials' ? 'bg-blue-600' : 'bg-gray-300'
              }`} />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Step {currentStep === 'tenant' ? '1' : currentStep === 'admin' ? '2' : '3'} of 3: 
            {currentStep === 'tenant' && 'Tenant Information'}
            {currentStep === 'admin' && 'Admin User Setup'}
            {currentStep === 'credentials' && 'Credential Display'}
          </div>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mx-6 mt-4 rounded">
            {error}
          </div>
        )}
        
        {renderCurrentStep()}
      </div>
    </div>
  );
}
