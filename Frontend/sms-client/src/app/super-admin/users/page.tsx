'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSuperAdminService, UserWithRoles } from '@/services/api/super-admin-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import UserEditModal from '@/components/common/UserEditModal';
import { PasswordResetDialog } from '@/components/common/PasswordResetDialog';
import { Edit, UserCheck, UserX, Plus, RefreshCw, KeyRound, UserPlus, Search } from 'lucide-react';
import { UserUpdate, UserCreateCrossTenant } from '@/services/api/super-admin-service';
import UserCreateModal from '@/components/common/UserCreateModal';
import { toast } from 'sonner';

import {
  useSuperAdminUserList,
  useSuperAdminCreateUser,
  useSuperAdminUpdateUser
} from '@/hooks/queries/super-admin';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';

export default function UserManagementPage() {
  // nuqs URL state
  const [emailQuery, setEmailQuery] = useQueryState('email', parseAsString.withDefault(''));
  const [tenantQuery, setTenantQuery] = useQueryState('tenant_id', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const pageSize = 10;

  // Manual loading state for async operations
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [modalAction, setModalAction] = useState<'activate' | 'deactivate' | 'edit' | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [resettingUser, setResettingUser] = useState<UserWithRoles | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // TanStack Query Hooks
  const { data: userData, isLoading, refetch } = useSuperAdminUserList({
    email: emailQuery || undefined,
    tenant_id: tenantQuery || undefined,
    skip: (page - 1) * pageSize,
    limit: pageSize,
  });

  const users = userData?.items || [];
  const totalCount = userData?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const createUser = useSuperAdminCreateUser();
  const updateUser = useSuperAdminUpdateUser();

  const isModalLoading = isManualLoading || createUser.isPending || updateUser.isPending;

  // Modal helpers
  const isConfirmationModalOpen = (modalAction === 'activate' || modalAction === 'deactivate') && selectedUserId !== null;
  const isEditModalOpen = modalAction === 'edit' && selectedUserId !== null;
  const selectedUser = users.find(user => user.id === selectedUserId);

  const closeModal = () => {
    setModalAction(null);
    setSelectedUserId(null);
  };

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // UI Action Handlers
  const showEditModal = (user: UserWithRoles) => {
    setSelectedUserId(user.id);
    setModalAction('edit');
  };

  const showActivateModal = (user: UserWithRoles) => {
    setSelectedUserId(user.id);
    setModalAction('activate');
  };

  const showDeactivateModal = (user: UserWithRoles) => {
    setSelectedUserId(user.id);
    setModalAction('deactivate');
  };

  const handleResetPassword = (user: UserWithRoles) => {
    setResettingUser(user);
  };

  // Async Save Handlers
  const handleCreateSave = async (data: UserCreateCrossTenant) => {
    setIsManualLoading(true);
    try {
      const response = await createUser.mutateAsync(data);
      toast.success(`User ${data.email} created successfully${response.generated_password ? `. Generated password: ${response.generated_password}` : ''}`);
      setIsCreateModalOpen(false);
      handleRefresh();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      const detail = error.response?.data?.detail || 'Failed to create user. Please try again.';
      toast.error(detail);
    } finally {
      setIsManualLoading(false);
    }
  };

  const handleModalConfirm = async () => {
    if (!selectedUser || !modalAction) return;

    const isActivating = modalAction === 'activate';
    setIsManualLoading(true);
    try {
      await updateUser.mutateAsync({
        userId: selectedUser.id,
        userData: { is_active: isActivating },
        tenantId: selectedUser.tenant_id
      });
      toast.success(`User ${isActivating ? 'activated' : 'deactivated'} successfully`);
      closeModal();
      handleRefresh();
    } catch (error) {
      console.error('Failed to update user status:', error);
      toast.error(`Failed to ${modalAction} user. Please try again.`);
    } finally {
      setIsManualLoading(false);
    }
  };

  const handleEditSave = async (updatedData: UserUpdate) => {
    if (!selectedUser) return;

    setIsManualLoading(true);
    try {
      await updateUser.mutateAsync({
        userId: selectedUser.id,
        userData: updatedData,
        tenantId: selectedUser.tenant_id
      });
      toast.success('User updated successfully');
      closeModal();
      handleRefresh();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Failed to update user');
    } finally {
      setIsManualLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (userId: string, newPassword?: string, newEmail?: string) => {
    if (!resettingUser) return;
    setIsManualLoading(true);
    try {
      const updatePayload: UserUpdate = {};
      if (newPassword) updatePayload.password = newPassword;
      if (newEmail) updatePayload.email = newEmail;

      await updateUser.mutateAsync({
        userId,
        userData: updatePayload,
        tenantId: resettingUser.tenant_id
      });
      toast.success('Password reset successfully');
      setResettingUser(null);
      handleRefresh();
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast.error('Failed to reset password');
    } finally {
      setIsManualLoading(false);
    }
  };

  const columnHelper = createColumnHelper<UserWithRoles>();

  const columns = [
    columnHelper.accessor(row => `${row.first_name} ${row.last_name}`, {
      id: 'name',
      header: 'Name',
      cell: info => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('email', {
      header: 'Email',
    }),
    columnHelper.accessor('roles', {
      header: 'Roles',
      cell: info => (
        <div className="flex flex-wrap gap-1">
          {info.getValue().map(role => (
            <span key={role.id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              {role.displayName || role.name}
            </span>
          ))}
        </div>
      ),
    }),
    columnHelper.accessor('is_active', {
      header: 'Status',
      cell: info => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.getValue() ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {info.getValue() ? 'Active' : 'Inactive'}
        </span>
      ),
    }),
    columnHelper.accessor('tenant_name', {
      header: 'Tenant',
      cell: info => <span className="text-sm text-gray-600">{info.getValue() || info.row.original.tenant_domain || 'Global'}</span>,
    }),
    columnHelper.accessor('last_login', {
      header: 'Last Login',
      cell: info => <span className="text-sm text-gray-600">{info.getValue() ? new Date(info.getValue()!).toLocaleString() : 'Never'}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: info => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => showEditModal(info.row.original)}
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            title="Edit user"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleResetPassword(info.row.original)}
            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            title="Reset Password"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          {info.row.original.is_active ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => showDeactivateModal(info.row.original)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Deactivate user"
            >
              <UserX className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => showActivateModal(info.row.original)}
              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              title="Activate user"
            >
              <UserCheck className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage all users across all tenants</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email..."
                className="pl-8"
                value={emailQuery}
                onChange={(e) => {
                  setEmailQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Input
              placeholder="Filter by Tenant ID or Name..."
              value={tenantQuery}
              onChange={(e) => {
                setTenantQuery(e.target.value);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600 font-medium">Total Users</p>
              <p className="text-2xl font-bold text-blue-800">{totalCount}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 font-medium">Active (this view)</p>
              <p className="text-2xl font-bold text-green-800">{users.filter(u => u.is_active).length}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm text-red-600 font-medium">Inactive (this view)</p>
              <p className="text-2xl font-bold text-red-800">{users.filter(u => !u.is_active).length}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-600 font-medium">Current Page</p>
              <p className="text-2xl font-bold text-purple-800">{page} / {totalPages || 1}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>User List ({totalCount} users)</CardTitle>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Page {page} of {totalPages || 1}</span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && users.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No users found matching your filters</p>
              <Button onClick={() => { setEmailQuery(''); setTenantQuery(''); setPage(1); }}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map(headerGroup => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map(row => (
                    <TableRow key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal for Activate/Deactivate */}
      {isConfirmationModalOpen && selectedUser && modalAction && (
        <ConfirmationModal
          isOpen={isConfirmationModalOpen}
          onConfirm={handleModalConfirm}
          onCancel={closeModal}
          title={modalAction === 'activate' ? 'Activate User' : 'Deactivate User'}
          message={`Are you sure you want to ${modalAction === 'activate' ? 'activate' : 'deactivate'} ${selectedUser.first_name} ${selectedUser.last_name}? ${modalAction === 'activate' ? 'This will allow the user to log in and access the system.' : 'This will prevent the user from logging in.'}`}
          confirmButtonText={modalAction === 'activate' ? 'Activate User' : 'Deactivate User'}
          confirmButtonColor={modalAction === 'activate' ? 'green' : 'red'}
          isLoading={isModalLoading}
        />
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <UserEditModal
          isOpen={isEditModalOpen}
          user={selectedUser}
          isLoading={isModalLoading}
          onSave={handleEditSave}
          onCancel={closeModal}
        />
      )}

      {/* Password Reset Dialog */}
      {resettingUser && (
        <PasswordResetDialog
          isOpen={!!resettingUser}
          onClose={() => setResettingUser(null)}
          userId={resettingUser.id}
          userName={`${resettingUser.first_name} ${resettingUser.last_name}`}
          userEmail={resettingUser.email}
          userType="User"
          onReset={handlePasswordResetSubmit}
        />
      )}

      {/* Create User Modal */}
      <UserCreateModal
        isOpen={isCreateModalOpen}
        isLoading={isModalLoading}
        onSave={handleCreateSave}
        onCancel={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}