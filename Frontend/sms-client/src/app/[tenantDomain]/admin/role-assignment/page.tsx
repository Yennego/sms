'use client';

import PermissionGuard from '@/components/auth/permission-guard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useUserService } from '@/services/api/user-service';
import {
  useRoles,
  useUserRoles,
  useAssignRolesToUser,
} from '@/hooks/queries/roles-permissions';
import type { User as AuthUser } from '@/types/auth';

export default function AdminRoleAssignmentPage() {
  const userService = useUserService();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Fetch users
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => userService.getUsers(0, 100),
  });

  // Fetch roles using TanStack Query
  const { data: allRoles = [], isLoading: rolesLoading } = useRoles();

  // Fetch selected user's current roles
  const { data: currentUserRoles = [] } = useUserRoles(selectedUserId);

  // Assign roles mutation
  const assignMutation = useAssignRolesToUser();

  // Filter out students and super-admin role for non-super-admins
  const users = useMemo(() => {
    return allUsers.filter((usr) => !isStudentUser(usr));
  }, [allUsers]);

  const roles = useMemo(() => {
    const isSuperAdmin = !!(user?.roles?.some((ro: any) => ro.name === 'super-admin') || user?.role === 'super-admin');
    return isSuperAdmin ? allRoles : allRoles.filter(role => role.name !== 'super-admin' && role.name !== 'superadmin');
  }, [allRoles, user]);

  // Sync selected role IDs when user's roles load
  // Use a stable key to avoid infinite loop
  const roleIdsKey = currentUserRoles.map(r => r.id).sort().join(',');
  useEffect(() => {
    if (selectedUserId && roleIdsKey) {
      setSelectedRoleIds(roleIdsKey.split(',').filter(Boolean));
    } else if (!selectedUserId) {
      setSelectedRoleIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, roleIdsKey]);

  const filteredUsers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u =>
      [u.first_name, u.last_name, u.email].some(v => v?.toLowerCase().includes(s))
    );
  }, [users, search]);

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const assignRoles = async () => {
    if (!selectedUserId) return;
    try {
      await assignMutation.mutateAsync({ userId: selectedUserId, roleIds: selectedRoleIds });
      toast.success('Roles assigned successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign roles');
    }
  };

  const isLoading = usersLoading || rolesLoading;

  return (
    <PermissionGuard requiredRole="admin" requiredPermissions={['manage_users']} fallback={<div>Access denied</div>}>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Assignment</CardTitle>
            <CardDescription>Assign roles to tenant users</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="rounded-md border p-2 max-h-[400px] overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  filteredUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`w-full text-left px-3 py-2 rounded ${selectedUserId === u.id ? 'bg-muted' : 'hover:bg-muted'}`}
                    >
                      <div className="font-medium">{u.first_name} {u.last_name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </button>
                  ))
                )}
                {!isLoading && filteredUsers.length === 0 && <div className="text-sm text-muted-foreground">No users found.</div>}
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm text-muted-foreground">
                {selectedUserId ? 'Select roles to assign to the chosen user.' : 'Select a user to begin.'}
              </div>
              <div className="rounded-md border p-2 max-h-[400px] overflow-auto">
                {roles.map(r => (
                  <label key={r.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted rounded">
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(r.id)}
                      onChange={() => toggleRoleSelection(r.id)}
                      disabled={!selectedUserId}
                    />
                    <div>
                      <div className="font-medium">{r.name}</div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </div>
                  </label>
                ))}
                {roles.length === 0 && <div className="text-sm text-muted-foreground">No roles available.</div>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={assignRoles} disabled={!selectedUserId || selectedRoleIds.length === 0 || assignMutation.isPending}>
                  {assignMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Assigning…</> : 'Assign Selected Roles'}
                </Button>
                <Button variant="secondary" onClick={() => setSelectedRoleIds([])} disabled={!selectedUserId || assignMutation.isPending}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}

// Helper: normalize and detect student users
const normalize = (s?: string) => (s || '').toLowerCase();
const isStudentUser = (u: AuthUser) => {
  const role = normalize(u.role);
  const type = normalize(u.type);
  const rolesArr = Array.isArray(u.roles) ? u.roles.map(r => normalize(r?.name)) : [];
  return role === 'student' || type === 'student' || rolesArr.includes('student');
};