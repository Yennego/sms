'use client';

import PermissionGuard from '@/components/auth/permission-guard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import React, { useEffect, useMemo, useState } from 'react';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  usePermissions,
  useRolePermissions,
  useSetRolePermissions,
} from '@/hooks/queries/roles-permissions';
import type { Role } from '@/services/api/role-permission-service';

export default function AdminRolesPage() {
  // TanStack Query hooks
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: permissions = [], isLoading: permissionsLoading } = usePermissions();

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();
  const setPermissionsMutation = useSetRolePermissions();

  const [search, setSearch] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedPermissionNames, setSelectedPermissionNames] = useState<string[]>([]);

  // Create role form
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Edit role state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');

  // Delete confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetRoleId, setConfirmTargetRoleId] = useState<string | null>(null);

  // Fetch role permissions when a role is selected
  const { data: currentRolePermissions = [] } = useRolePermissions(selectedRoleId);

  // Sync selected permissions when role selection changes
  // Use JSON.stringify to create a stable dependency
  const permissionNamesKey = currentRolePermissions.map(p => p.name).sort().join(',');
  useEffect(() => {
    if (selectedRoleId && permissionNamesKey) {
      setSelectedPermissionNames(permissionNamesKey.split(',').filter(Boolean));
    } else if (!selectedRoleId) {
      setSelectedPermissionNames([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoleId, permissionNamesKey]);

  const filteredRoles = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return roles;
    return roles.filter(r => [r.name, r.description].some(v => v?.toLowerCase().includes(s)));
  }, [roles, search]);

  const togglePermission = (permName: string) => {
    setSelectedPermissionNames(prev =>
      prev.includes(permName) ? prev.filter(n => n !== permName) : [...prev, permName]
    );
  };

  const savePermissions = async () => {
    if (!selectedRoleId) return;
    try {
      await setPermissionsMutation.mutateAsync({ roleId: selectedRoleId, permissionNames: selectedPermissionNames });
      toast.success('Role permissions updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save role permissions');
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: newRoleName.trim(),
        description: newRoleDesc.trim() || undefined,
      });
      setNewRoleName('');
      setNewRoleDesc('');
      toast.success('Role created successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create role');
    }
  };

  const startEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setEditRoleName(role.name);
    setEditRoleDesc(role.description || '');
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setEditRoleName('');
    setEditRoleDesc('');
  };

  const handleUpdateRole = async () => {
    if (!editingRoleId || !editRoleName.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: editingRoleId,
        data: {
          name: editRoleName.trim(),
          description: editRoleDesc.trim() || undefined,
        },
      });
      cancelEditRole();
      toast.success('Role updated successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      await deleteMutation.mutateAsync(roleId);
      if (selectedRoleId === roleId) setSelectedRoleId(null);
      if (editingRoleId === roleId) cancelEditRole();
      toast.success('Role deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete role');
    } finally {
      setConfirmOpen(false);
      setConfirmTargetRoleId(null);
    }
  };

  const isLoading = rolesLoading || permissionsLoading;
  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || setPermissionsMutation.isPending;

  return (
    <PermissionGuard requiredRole="admin" requiredPermissions={['manage_roles']} fallback={<div>Access denied</div>}>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Manage roles and their permissions</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {/* Search input */}
              <div className="space-y-3 mb-4">
                <Input
                  placeholder="Search roles…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* Create Role */}
              <div className="space-y-3 mb-4">
                <Input
                  placeholder="Role name (e.g., teacher_admin)"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                {!newRoleName.trim() && <div className="text-xs text-red-600">Name is required.</div>}
                <Input
                  placeholder="Description (optional)"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreateRole} disabled={!newRoleName.trim() || createMutation.isPending}>
                    {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : 'Create Role'}
                  </Button>
                </div>
              </div>

              {/* Roles list with inline edit/delete */}
              <div className="rounded-md border p-2 max-h-[400px] overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  filteredRoles.map((r) => (
                    <div key={r.id} className="px-3 py-2 border-b last:border-b-0">
                      {editingRoleId === r.id ? (
                        <div className="space-y-2">
                          <Input placeholder="Name" value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)} />
                          {!editRoleName.trim() && <div className="text-xs text-red-600">Name is required.</div>}
                          <Input placeholder="Description (optional)" value={editRoleDesc} onChange={(e) => setEditRoleDesc(e.target.value)} />
                          <div className="flex gap-2">
                            <Button onClick={handleUpdateRole} disabled={!editRoleName.trim() || updateMutation.isPending}>
                              {updateMutation.isPending ? 'Saving…' : 'Save'}
                            </Button>
                            <Button variant="outline" onClick={cancelEditRole}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setSelectedRoleId(r.id)}
                            className={`text-left px-3 py-1 rounded ${selectedRoleId === r.id ? 'bg-muted' : 'hover:bg-muted'}`}
                          >
                            <div className="font-medium">{r.name}</div>
                            {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                          </button>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => startEditRole(r)} disabled={isMutating}>Edit</Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setConfirmTargetRoleId(r.id);
                                setConfirmOpen(true);
                              }}
                              disabled={isMutating}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {!isLoading && filteredRoles.length === 0 && <div className="text-sm text-muted-foreground">No roles found.</div>}
              </div>
            </div>

            {/* Permissions panel */}
            <div>
              <div className="mb-3 text-sm text-muted-foreground">
                {selectedRoleId ? 'Toggle permissions for the selected role.' : 'Select a role to begin.'}
              </div>
              <div className="rounded-md border p-2 max-h-[400px] overflow-auto">
                {permissions.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted rounded">
                    <input
                      type="checkbox"
                      checked={selectedPermissionNames.includes(p.name)}
                      onChange={() => togglePermission(p.name)}
                      disabled={!selectedRoleId}
                    />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                    </div>
                  </label>
                ))}
                {permissions.length === 0 && <div className="text-sm text-muted-foreground">No permissions available.</div>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={savePermissions} disabled={!selectedRoleId || setPermissionsMutation.isPending}>
                  {setPermissionsMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : 'Save Changes'}
                </Button>
                <Button variant="secondary" onClick={() => setSelectedPermissionNames([])} disabled={!selectedRoleId || isMutating}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Modal */}
        {confirmTargetRoleId && (
          <ConfirmationModal
            isOpen={confirmOpen}
            title="Delete role?"
            message="Are you sure you want to delete this role? This cannot be undone."
            confirmButtonText="Delete"
            confirmButtonColor="red"
            isLoading={deleteMutation.isPending}
            onConfirm={() => handleDeleteRole(confirmTargetRoleId)}
            onCancel={() => {
              setConfirmOpen(false);
              setConfirmTargetRoleId(null);
            }}
          />
        )}
      </div>
    </PermissionGuard>
  );
}