'use client';

import { useState } from 'react';
import { Tenant } from '@/types/tenant';
import { useTenantService } from '@/services/api/tenant-service';
import Image from 'next/image';
import ConfirmationModal from '@/components/common/ConfirmationModal';

interface TenantListProps {
  tenants: Tenant[];
  onEdit: (tenant: Tenant) => void;
  onRefresh: () => void;
  onActivate?: (id: string) => Promise<void>;
  onDeactivate?: (id: string) => Promise<void>;
}

export default function TenantList({ 
  tenants = [], // Default to empty array
  onEdit, 
  onRefresh, 
  onActivate, 
  onDeactivate 
}: TenantListProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<'activate' | 'deactivate' | 'delete' | null>(null);

  console.log("received Tenants:", tenants);
  
  const tenantService = useTenantService();
  
  // Modal state helpers
  const isModalOpen = modalAction !== null && selectedTenantId !== null;
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);
  
  const closeModal = () => {
    setModalAction(null);
    setSelectedTenantId(null);
  };
  
  // Get modal props based on action
  const getModalProps = () => {
    if (!selectedTenant) {
      // Return default values for required props
      return {
        title: 'Confirmation',
        message: 'Are you sure you want to perform this action?',
        confirmButtonText: 'Confirm',
        confirmButtonColor: 'blue',
      };
    }
    
    switch (modalAction) {
      case 'activate':
        return {
          title: 'Activate Tenant',
          message: `Are you sure you want to activate ${selectedTenant.name}?`,
          confirmButtonText: 'Activate',
          confirmButtonColor: 'green',
        };
      case 'deactivate':
        return {
          title: 'Deactivate Tenant',
          message: `Are you sure you want to deactivate ${selectedTenant.name}?`,
          confirmButtonText: 'Deactivate',
          confirmButtonColor: 'yellow',
        };
      case 'delete':
        return {
          title: 'Delete Tenant',
          message: `Are you sure you want to delete ${selectedTenant.name}? This action cannot be undone.`,
          confirmButtonText: 'Delete',
          confirmButtonColor: 'red',
        };
      default:
        return {
          title: 'Confirmation',
          message: 'Are you sure you want to perform this action?',
          confirmButtonText: 'Confirm',
          confirmButtonColor: 'blue',
        };
    }
  };
  
  // Handle modal confirmation
  const handleModalConfirm = async () => {
    if (!selectedTenantId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      switch (modalAction) {
        case 'activate':
          await handleActivate(selectedTenantId);
          break;
        case 'deactivate':
          await handleDeactivate(selectedTenantId);
          break;
        case 'delete':
          await handleDelete(selectedTenantId);
          break;
      }
      // Close modal after the operation completes successfully
      closeModal();
    } catch (error) {
      // Handle error but don't close modal on error
      console.error('Modal action failed:', error);
      setError(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Show modal for actions
  const showActivateModal = (id: string) => {
    setSelectedTenantId(id);
    setModalAction('activate');
  };
  
  const showDeactivateModal = (id: string) => {
    setSelectedTenantId(id);
    setModalAction('deactivate');
  };
  
  const showDeleteModal = (id: string) => {
    setSelectedTenantId(id);
    setModalAction('delete');
  };
  
  const handleActivate = async (id: string) => {
    console.log(`Starting activation for tenant ${id}`);
    setError(null);
    
    try {
      if (onActivate) {
        // Let the parent component handle activation
        await onActivate(id);
        // Don't call onRefresh here, let the parent handle it
      } else {
        // Handle activation locally
        await tenantService.activateTenant(id);
        // Only refresh if we're handling it locally
        await onRefresh();
      }
    } catch (err) {
      console.error(`Activation error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to activate tenant');
      throw err; // Rethrow to let handleModalConfirm handle it
    }
    console.log(`Activation process completed`);
  };
  
  const handleDeactivate = async (id: string) => {
    setError(null);
    
    try {
      if (onDeactivate) {
        // Let the parent component handle deactivation
        await onDeactivate(id);
        // Don't call onRefresh here, let the parent handle it
      } else {
        // Handle deactivation locally
        await tenantService.deactivateTenant(id);
        // Only refresh if we're handling it locally
        await onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate tenant');
      throw err; // Rethrow to let handleModalConfirm handle it
    }
  };
  
  const handleDelete = async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await tenantService.deleteTenant(id);
      await onRefresh();
    } catch (err: Error | unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete tenant');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3">
          {error}
        </div>
      )}
      
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Domain/Subdomain
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created At
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {!tenants || tenants.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                No tenants found
              </td>
            </tr>
          ) : (
            tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {tenant.logo ? (
                      <Image
                        className="h-10 w-10 rounded-full mr-3"
                        src={tenant.logo}
                        alt={tenant.name}
                        width={40}
                        height={40}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                        {tenant.name.charAt(0)}
                      </div>
                    )}
                    <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {tenant.domain || tenant.subdomain || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {tenant.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onEdit(tenant)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                    disabled={isLoading}
                  >
                    Edit
                  </button>
                  {tenant.isActive ? (
                    <button
                      onClick={() => showDeactivateModal(tenant.id)}
                      className="text-yellow-600 hover:text-yellow-900 mr-3"
                      disabled={isLoading}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => showActivateModal(tenant.id)}
                      className="text-green-600 hover:text-green-900 mr-3"
                      disabled={isLoading}
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => showDeleteModal(tenant.id)}
                    className="text-red-600 hover:text-red-900"
                    disabled={isLoading}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {/* Confirmation Modal */}
      {isModalOpen && selectedTenant && modalAction && (
        <ConfirmationModal
          isOpen={isModalOpen}
          onConfirm={handleModalConfirm}
          onCancel={closeModal}
          isLoading={isLoading}
          {...getModalProps()}
        />
      )}
    </div>
  );
}