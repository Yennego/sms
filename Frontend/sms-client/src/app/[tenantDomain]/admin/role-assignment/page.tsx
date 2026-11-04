'use client';

import PermissionGuard from '@/components/auth/permission-guard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Loader2, Lock } from 'lucide-react';
import { useSchoolAreas } from '@/hooks/use-tenant-features';
import { roleLabel } from '@/config/permission-catalogue';
import { useQuery } from '@tanstack/react-query';
import { useUserService } from '@/services/api/user-service';
import {
  useRoles,
  useUserRoles,
  useAssignRolesToUser,
  useRemoveRoleFromUser,
} from '@/hooks/queries/roles-permissions';

// The rules the server enforces (only the platform operator is exempt): never your own roles,
// never the admin role, only roles whose permissions you hold yourself
const ADMIN_ROLE_NAMES = ['admin', 'tenant-admin'];
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
  const removeMutation = useRemoveRoleFromUser();
  const saving = assignMutation.isPending || removeMutation.isPending;
  const isOperator = !!(user?.roles?.some((ro) => ro.name === 'super-admin') || user?.role === 'super-admin');
  const isSelf = !!selectedUserId && selectedUserId === user?.id;
  const heldPermissions = useMemo(() => new Set(user?.permissions ?? []), [user]);

  /** Why this role can't be given or taken here, if it can't */
  const lockReason = (role: { name: string; permissions?: { name: string }[] }): string | null => {
    if (isOperator) return null;
    if (ADMIN_ROLE_NAMES.includes(role.name)) return 'Only the platform operator gives or removes the admin role.';
    if ((role.permissions ?? []).some((p) => !heldPermissions.has(p.name))) {
      return 'It allows more than your own roles do. Ask the platform operator.';
    }
    return null;
  };

  // A role whose every permission is in an area switched off for this school can't be given
  const { offAreaFor } = useSchoolAreas();
  const offAreasOf = (role: { permissions?: { name: string }[] }) => {
    const perms = role.permissions ?? [];
    const areas = perms.map((p) => offAreaFor(p.name));
    if (perms.length === 0 || areas.some((a) => !a)) return [];
    return Array.from(new Set(areas.map((a) => a!.label)));
  };

  // Filter out students and super-admin role for non-super-admins
  const users = useMemo(() => {
    return allUsers.filter((usr) => {
      // Filter out students
      if (isStudentUser(usr)) return false;
      
      // Filter out super-admins/superadmin for total isolation
      const roles = Array.isArray(usr.roles) ? usr.roles.map((r: { name?: string }) => r.name?.toLowerCase()) : [];
      if (roles.includes('super-admin') || roles.includes('superadmin') || usr.role === 'super-admin') {
        return false;
      }
      
      return true;
    });
  }, [allUsers]);

  const roles = useMemo(() => {
    return isOperator ? allRoles : allRoles.filter(role => role.name !== 'super-admin' && role.name !== 'superadmin');
  }, [allRoles, isOperator]);

  // Sync selected role IDs when user's roles load
  // Use a stable key to avoid infinite loop
  const roleIdsKey = currentUserRoles.map(r => r.id).sort().join(',');
  useEffect(() => {
    // A user with no roles starts empty (not with the previous user's ticks)
    setSelectedRoleIds(selectedUserId ? roleIdsKey.split(',').filter(Boolean) : []);
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

  // Saving adds the newly ticked roles and removes the unticked ones
  const assignRoles = async () => {
    if (!selectedUserId) return;
    const held = currentUserRoles.map((r) => r.id);
    const added = selectedRoleIds.filter((id) => !held.includes(id));
    const removed = held.filter((id) => !selectedRoleIds.includes(id));
    if (added.length === 0 && removed.length === 0) {
      toast.info('Nothing changed.');
      return;
    }
    try {
      if (added.length) await assignMutation.mutateAsync({ userId: selectedUserId, roleIds: added });
      for (const roleId of removed) await removeMutation.mutateAsync({ userId: selectedUserId, roleId });
      toast.success('Roles saved');
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "The roles weren't saved");
    }
  };

  const isLoading = usersLoading || rolesLoading;

  return (
    <PermissionGuard requiredRole="admin" requiredPermissions={['manage_users']} fallback={<div>Access denied</div>}>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Assignment</CardTitle>
            <CardDescription>Give roles to your school&apos;s staff</CardDescription>
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
                {!selectedUserId
                  ? 'Select a user to begin.'
                  : isSelf && !isOperator
                    ? "You can't change your own roles. Ask another admin or the platform operator."
                    : 'Tick the roles this person should have, then save.'}
              </div>
              <div className="rounded-md border p-2 max-h-[400px] overflow-auto">
                {roles.map(r => {
                  const off = offAreasOf(r);
                  const reason = lockReason(r);
                  const locked = off.length > 0 || Boolean(reason) || (isSelf && !isOperator);
                  return (
                    <label
                      key={r.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(r.id)}
                        onChange={() => toggleRoleSelection(r.id)}
                        disabled={!selectedUserId || locked}
                      />
                      <div>
                        <div className="flex items-center gap-1 font-medium">
                          {roleLabel(r.name)}
                          {locked ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{r.name}</div>
                        {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                        {off.length > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {off.join(' and ')} {off.length === 1 ? 'is' : 'are'} turned off for this school. Ask the platform operator.
                          </div>
                        ) : reason ? (
                          <div className="text-xs text-muted-foreground">{reason}</div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
                {roles.length === 0 && <div className="text-sm text-muted-foreground">No roles available.</div>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={assignRoles} disabled={!selectedUserId || (isSelf && !isOperator) || saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : 'Save roles'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setSelectedRoleIds(currentUserRoles.map((r) => r.id))}
                  disabled={!selectedUserId || saving}
                >
                  Undo changes
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