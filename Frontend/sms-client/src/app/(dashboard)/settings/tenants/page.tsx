'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenantService } from '@/services/api/tenant-service';
import { Tenant } from '@/types/tenant';
import PermissionGuard from '@/components/auth/permission-guard';
import TenantList from '@/components/tenant/tenant-list';
import TenantForm from '@/components/tenant/tenant-form';

export default function TenantsManagementPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  
  const tenantService = useTenantService();
  
  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await tenantService.getTenants();
      await new Promise((r) => setTimeout(r, 300)); // wait 300ms 
      // await loadTenants();
      setTenants([...data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setIsLoading(false);
    }
  }, [tenantService]);
  
  useEffect(() => {
    loadTenants();
  }, []); //loadTenants
  
  const handleCreateTenant = () => {
    setSelectedTenant(null);
    setShowForm(true);
  };
  
  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowForm(true);
  };
  
  const handleFormClose = () => {
    setShowForm(false);
    setSelectedTenant(null);
  };
  
  const handleFormSubmit = async () => {
    await loadTenants();
    setShowForm(false);
    setSelectedTenant(null);
  };
  
  return (
    <PermissionGuard requiredRole="superadmin" fallback={<div>You don&apos;t have permission to access this page.</div>}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Tenant Management</h1>
          <button
            onClick={handleCreateTenant}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Create Tenant
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="text-center py-4">Loading tenants...</div>
        ) : (
          <TenantList 
            tenants={tenants} 
            onEdit={handleEditTenant} 
            onRefresh={loadTenants}
            onActivate={async (id) => {
              await tenantService.activateTenant(id);
              await loadTenants();
            }}
            onDeactivate={async (id) => {
              await tenantService.deactivateTenant(id);
              await loadTenants();
            }}
          />
        )}
        
        {showForm && (
          <TenantForm
            tenant={selectedTenant}
            onClose={handleFormClose}
            onSubmit={handleFormSubmit}
          />
        )}
      </div>
    </PermissionGuard>
  );
}