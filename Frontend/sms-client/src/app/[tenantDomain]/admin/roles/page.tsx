'use client';

// The school's roles, read only: roles and what they allow are set by the platform operator
// (schools ask for what they need). Permissions of an area switched off for this school show
// greyed out with a lock. Handing roles to people is on Role assignment.

import PermissionGuard from '@/components/auth/permission-guard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { GroupedPermissions } from '@/components/roles/grouped-permissions';
import { roleLabel } from '@/config/permission-catalogue';
import { useRoles } from '@/hooks/queries/roles-permissions';
import { useSchoolAreas } from '@/hooks/use-tenant-features';

export default function AdminRolesPage() {
  const { data: roles = [], isLoading } = useRoles();
  const { offAreaFor } = useSchoolAreas();
  const [search, setSearch] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const visibleRoles = useMemo(() => {
    const s = search.trim().toLowerCase();
    return roles
      .filter((r) => r.name !== 'super-admin' && r.name !== 'superadmin')
      .filter((r) => !s || [r.name, roleLabel(r.name), r.description].some((v) => v?.toLowerCase().includes(s)));
  }, [roles, search]);

  const selected = roles.find((r) => r.id === selectedRoleId) ?? null;
  const permissions = selected?.permissions ?? [];

  return (
    <PermissionGuard requiredRole="admin" requiredPermissions={['manage_roles']} fallback={<div>Access denied</div>}>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>What each role allows at this school</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Roles and what they allow are set by the platform operator. If someone at your school needs access
                that no role gives, ask the platform operator. To give a role to a person, use Role assignment.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Input
                  className="mb-3"
                  placeholder="Search roles…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search roles"
                />
                <div className="max-h-[400px] overflow-auto rounded-md border p-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading roles" />
                    </div>
                  ) : (
                    visibleRoles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRoleId(r.id)}
                        aria-pressed={selectedRoleId === r.id}
                        className={`block w-full rounded px-3 py-2 text-left ${selectedRoleId === r.id ? 'bg-muted' : 'hover:bg-muted'}`}
                      >
                        <div className="font-medium">{roleLabel(r.name)}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.name}</div>
                        {r.adjusted_for_school ? (
                          <div className="text-xs text-blue-800">Set up for your school by the platform operator</div>
                        ) : null}
                        {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                      </button>
                    ))
                  )}
                  {!isLoading && visibleRoles.length === 0 && (
                    <div className="text-sm text-muted-foreground">No roles found.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm text-muted-foreground">
                  {selected ? `What ${roleLabel(selected.name)} allows:` : 'Choose a role to see what it allows.'}
                </div>
                <div role="region" className="max-h-[480px] overflow-auto rounded-md border p-2" aria-label="Permissions of the role">
                  {selected && permissions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">This role has no permissions of its own.</p>
                  ) : (
                    <GroupedPermissions permissions={permissions} offAreaFor={offAreaFor} />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
