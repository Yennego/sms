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
  onManageFeatures?: (tenant: Tenant) => void;
}

export default function TenantList({
  tenants = [], // Default to empty array
  onEdit,
  onRefresh,
  onActivate,
  onDeactivate,
  onManageFeatures
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
    <div className="bg-white shadow-md rounded-lg overflow-x-auto border border-gray-100">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      <table className="min-w-[1200px] w-full divide-y divide-gray-200">
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
              Plan
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created At
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {!tenants || tenants.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                No tenants found
              </td>
            </tr>
          ) : (
            tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {tenant.logo ? (
                      <Image
                        className="h-10 w-10 rounded-full mr-3 border border-gray-100 shadow-sm"
                        src={tenant.logo}
                        alt={tenant.name}
                        width={40}
                        height={40}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3 font-semibold border border-indigo-100 shadow-sm">
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
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${(tenant.isActive ?? (tenant as any).is_active) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {(tenant.isActive ?? (tenant as any).is_active) ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                  {tenant.plan_type?.replace('_', ' ') || 'Flat Rate'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                  ${tenant.plan_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  {tenant.plan_type === 'per_user' && <span className="text-[10px] text-gray-400 ml-1">/user</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(() => {
                    const dateStr = tenant.createdAt ?? (tenant as any).created_at;
                    return dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-white/95 backdrop-blur-sm shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => onEdit(tenant)}
                      className="text-indigo-600 hover:text-indigo-900 transition-colors duration-200"
                      disabled={isLoading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onManageFeatures?.(tenant)}
                      className="text-blue-600 hover:text-blue-900 transition-colors duration-200"
                      disabled={isLoading}
                    >
                      Modules
                    </button>
                    {tenant.isActive ? (
                      <button
                        onClick={() => showDeactivateModal(tenant.id)}
                        className="text-amber-600 hover:text-amber-900 transition-colors duration-200"
                        disabled={isLoading}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => showActivateModal(tenant.id)}
                        className="text-emerald-600 hover:text-emerald-900 transition-colors duration-200"
                        disabled={isLoading}
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => showDeleteModal(tenant.id)}
                      className="text-rose-600 hover:text-rose-900 transition-colors duration-200"
                      disabled={isLoading}
                    >
                      Delete
                    </button>
                  </div>
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