'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import React, { useMemo, useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  usePermissions,
  useCreatePermission,
  useUpdatePermission,
  useDeletePermission,
} from '@/hooks/queries/roles-permissions';
import type { Permission } from '@/services/api/role-permission-service';

export default function AdminPermissionsPage() {
  // TanStack Query hooks
  const { data: permissions = [], isLoading } = usePermissions();
  const createMutation = useCreatePermission();
  const updateMutation = useUpdatePermission();
  const deleteMutation = useDeletePermission();

  // Create-permission form state
  const [search, setSearch] = useState('');
  const [permName, setPermName] = useState('');
  const [permDesc, setPermDesc] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Delete confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Permission | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return permissions;
    return permissions.filter((p) => [p.name, p.description].some((v) => v?.toLowerCase().includes(s)));
  }, [permissions, search]);

  const canSubmit = permName.trim().length > 0;

  const startEdit = (p: Permission) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDesc(p.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
  };

  const handleCreatePermission = async () => {
    if (!canSubmit) return;
    try {
      await createMutation.mutateAsync({
        name: permName.trim(),
        description: permDesc.trim() || undefined,
      });
      setPermName('');
      setPermDesc('');
      toast.success('Permission created successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create permission');
    }
  };

  const handleUpdatePermission = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: editingId,
        data: {
          name: editName.trim() || undefined,
          description: editDesc.trim() || undefined,
        },
      });
      cancelEdit();
      toast.success('Permission updated successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update permission');
    }
  };

  const handleDeletePermission = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      if (editingId === id) cancelEdit();
      toast.success('Permission deleted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete permission');
    } finally {
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <PermissionGuard requiredRole="admin" requiredPermissions={['manage_permissions']} fallback={<div>Access denied</div>}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header + Search */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Permissions</h1>
          <Input
            placeholder="Search permissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Create form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="Permission name (e.g., manage_users)"
            value={permName}
            onChange={(e) => setPermName(e.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={permDesc}
            onChange={(e) => setPermDesc(e.target.value)}
          />
        </div>
        {!canSubmit && <div className="text-xs text-red-600">Name is required.</div>}
        <div className="flex gap-2">
          <Button onClick={handleCreatePermission} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : 'Create Permission'}
          </Button>
        </div>

        {/* Permissions list with edit/delete */}
        <div className="rounded border divide-y">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No permissions found.</div>
          ) : (
            filtered.map((p) => (
              <div key={p.id} className="p-4 flex items-start justify-between gap-4">
                {editingId === p.id ? (
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Permission name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleUpdatePermission} disabled={!editName.trim() || updateMutation.isPending}>
                        {updateMutation.isPending ? 'Saving…' : 'Save'}
                      </Button>
                      <Button variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    {p.description && <div className="text-sm text-gray-600">{p.description}</div>}
                  </div>
                )}

                {editingId !== p.id && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => startEdit(p)} disabled={isMutating}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setConfirmTarget(p);
                        setConfirmOpen(true);
                      }}
                      disabled={isMutating}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Confirmation modal for delete */}
        <ConfirmationModal
          isOpen={confirmOpen}
          title="Delete Permission"
          message={`Are you sure you want to delete "${confirmTarget?.name}"? This cannot be undone.`}
          confirmButtonText="Delete"
          confirmButtonColor="red"
          isLoading={deleteMutation.isPending}
          onConfirm={() => confirmTarget && handleDeletePermission(confirmTarget.id)}
          onCancel={() => {
            setConfirmOpen(false);
            setConfirmTarget(null);
          }}
        />
      </div>
    </PermissionGuard>
  );
}
