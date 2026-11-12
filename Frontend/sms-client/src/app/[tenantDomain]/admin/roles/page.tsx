'use client';

// The school's roles, read only: roles and what they allow are set by the platform operator
// (schools ask for what they need). Permissions of an area switched off for this school show
// greyed out with a lock. Handing roles to people is on Role assignment.

import PermissionGuard from '@/components/auth/permission-guard';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { GroupedPermissions } from '@/components/roles/grouped-permissions';
import { roleLabel } from '@/config/permission-catalogue';
import { useRoles } from '@/hooks/queries/roles-permissions';
import { useSchoolAreas } from '@/hooks/use-tenant-features';
import { cn } from '@/lib/utils';

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
    <PermissionGuard
      requiredRole="admin"
      requiredPermissions={['manage_roles']}
      fallback={
        <PageShell title="Roles">
          <EmptyState
            icon={ShieldAlert}
            title="Not available for your role"
            description="Your role can't see the school's roles. Ask the school's administrator if you need access."
          />
        </PageShell>
      }
    >
      <PageShell title="Roles" description="What each role allows at this school.">
        <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Roles and what they allow are set by the platform operator. If someone at your school needs access
            that no role gives, ask the platform operator. To give a role to a person, use Role assignment.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section aria-label="Roles" className="min-w-0 space-y-3">
            <Input
              className="h-11 text-base md:h-9 md:text-sm"
              placeholder="Search roles"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search roles"
            />
            <div className="max-h-[480px] overflow-auto rounded-xl border bg-card p-2">
              {isLoading ? (
                <div className="space-y-2 p-1" aria-busy="true" aria-label="Loading roles">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                visibleRoles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRoleId(r.id)}
                    aria-pressed={selectedRoleId === r.id}
                    className={cn(
                      'block min-h-11 w-full rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      selectedRoleId === r.id ? 'bg-muted' : 'hover:bg-muted/60'
                    )}
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
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {search.trim() ? 'No roles match your search. Try another word.' : 'No roles yet. Ask the platform operator.'}
                </p>
              )}
            </div>
          </section>

          <section aria-label="What the role allows" className="min-w-0 space-y-3">
            <p className="text-sm text-muted-foreground md:flex md:min-h-9 md:items-center">
              {selected ? `What ${roleLabel(selected.name)} allows:` : 'Choose a role to see what it allows.'}
            </p>
            <div role="region" className="max-h-[480px] overflow-auto rounded-xl border bg-card p-2" aria-label="Permissions of the role">
              {selected && permissions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">This role has no permissions of its own.</p>
              ) : (
                <GroupedPermissions permissions={permissions} offAreaFor={offAreaFor} />
              )}
            </div>
          </section>
        </div>
      </PageShell>
    </PermissionGuard>
  );
}
