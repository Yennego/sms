'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenantService } from '@/services/api/tenant-service';
import { Tenant } from '@/types/tenant';
import TenantList from '@/components/tenant/tenant-list';
import TenantForm from '@/components/tenant/tenant-form';
import TenantCreationWizard from '@/components/tenant/tenant-creation-wizard';
import Pagination from '@/components/common/Pagination';

export default function TenantsManagementPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalTenants, setTotalTenants] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  
  const tenantService = useTenantService();
  
  const loadTenants = useCallback(async (page: number = currentPage, limit: number = itemsPerPage) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const skip = (page - 1) * limit;
      const response = await tenantService.getTenants(skip, limit);
      
      setTenants(response.items);
      setTotalTenants(response.total);
    } catch (err) {
      console.error('Error loading tenants:', err);
      setTenants([]);
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setIsLoading(false);
    }
  }, [tenantService, currentPage, itemsPerPage]);
  
  useEffect(() => {
    loadTenants();
  }, [loadTenants]);
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadTenants(page, itemsPerPage);
  };
  
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    loadTenants(1, newItemsPerPage);
  };
  
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
    // Add a small delay to ensure the update is committed
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadTenants();
    setShowForm(false);
    setSelectedTenant(null);
  };
  
  // In TenantsManagementPage component
  const handleActivateTenant = async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await tenantService.activateTenant(id);
      // Immediately reload data to ensure UI is updated
      await loadTenants();
    } catch (error) {
      console.error('Activation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to activate tenant');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeactivateTenant = async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await tenantService.deactivateTenant(id);
      // Immediately reload data to ensure UI is updated
      await loadTenants();
    } catch (error) {
      console.error('Deactivation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to deactivate tenant');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
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
        <>
          <TenantList 
            tenants={tenants} 
            onEdit={handleEditTenant} 
            onRefresh={() => loadTenants(currentPage, itemsPerPage)}
            onActivate={handleActivateTenant}
            onDeactivate={handleDeactivateTenant} 
          />
          
          <Pagination
            currentPage={currentPage}
            totalItems={totalTenants}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </>
      )}
      
      {showForm && !selectedTenant && (
        <TenantCreationWizard
          onClose={handleFormClose}
          onComplete={handleFormSubmit}
        />
      )}
      
      {showForm && selectedTenant && (
        <TenantForm
          tenant={selectedTenant}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}