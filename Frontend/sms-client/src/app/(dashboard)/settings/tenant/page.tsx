'use client';

import { useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import { useTenant } from '@/hooks/use-tenant';
import { useTenantService } from '@/services/api/tenant-service';
import SettingsForm from '@/components/settings/settings-form';
import { TenantUpdate } from '@/types/tenant';

export default function TenantSettingsPage() {
  const { tenant, setTenant } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const tenantService = useTenantService();
  
  const tenantSettingsFields = [
    {
      id: 'name',
      label: 'Tenant Name',
      type: 'text' as const,
      placeholder: 'Enter tenant name'
    },
    {
      id: 'domain',
      label: 'Domain',
      type: 'text' as const,
      placeholder: 'Enter domain (e.g., example.com)'
    },
    {
      id: 'subdomain',
      label: 'Subdomain',
      type: 'text' as const,
      placeholder: 'Enter subdomain (e.g., school)'
    },
    {
      id: 'logo',
      label: 'Logo URL',
      type: 'text' as const,
      placeholder: 'Enter logo URL'
    },
    {
      id: 'primaryColor',
      label: 'Primary Color',
      type: 'color' as const
    },
    {
      id: 'secondaryColor',
      label: 'Secondary Color',
      type: 'color' as const
    },
    {
      id: 'isActive',
      label: 'Active',
      type: 'checkbox' as const
    }
  ];
  
  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    if (!tenant) return;
    
    setIsLoading(true);
    
    try {
      const tenantUpdate: TenantUpdate = {
        name: values.name as string,
        domain: values.domain as string,
        subdomain: values.subdomain as string,
        logo: values.logo as string,
        primaryColor: values.primaryColor as string,
        secondaryColor: values.secondaryColor as string,
        isActive: values.isActive as boolean
      };
      
      const updatedTenant = await tenantService.updateTenant(tenant.id, tenantUpdate);
      setTenant(updatedTenant);
    } catch (error) {
      console.error('Failed to update tenant settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initialize form values from tenant data
  const initialValues: Record<string, string | number | boolean> = tenant ? {
    name: tenant.name || '',
    domain: tenant.domain || '',
    subdomain: tenant.subdomain || '',
    logo: tenant.logo || '',
    primaryColor: tenant.primaryColor || '#3B82F6',
    secondaryColor: tenant.secondaryColor || '#1E40AF',
    isActive: tenant.isActive
  } : {};
  
  return (
    <PermissionGuard requiredRole="admin" fallback={<div>You do not have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Tenant Settings</h1>
        
        <div className="space-y-8">
          {tenant ? (
            <SettingsForm
              title="Tenant Configuration"
              description="Customize your tenant settings"
              fields={tenantSettingsFields}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          ) : (
            <div className="bg-white shadow-md rounded-lg p-6">
              <p className="text-gray-500">Loading tenant information...</p>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}