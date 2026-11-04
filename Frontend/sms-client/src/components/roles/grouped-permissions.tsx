'use client';

// Permissions grouped by area with plain-language names (config/permission-catalogue.ts). Read only
// without onToggle; with it, each permission has a checkbox. A permission whose area is turned off
// for the school shows greyed out with a lock and can't be ticked.

import { Check, Lock } from 'lucide-react';

import { groupPermissions, permissionLabel } from '@/config/permission-catalogue';
import type { SchoolArea } from '@/config/school-areas';

interface PermissionLike {
  id: string;
  name: string;
}

export function GroupedPermissions({
  permissions,
  selected,
  onToggle,
  offAreaFor,
  disabled = false,
}: {
  permissions: PermissionLike[];
  /** Ticked permission names (editable lists only) */
  selected?: string[];
  onToggle?: (name: string) => void;
  offAreaFor?: (name: string) => SchoolArea | undefined;
  disabled?: boolean;
}) {
  const editable = Boolean(onToggle);
  return (
    <div className="space-y-4">
      {groupPermissions(permissions).map(({ group, items }) => (
        <section key={group.key} aria-labelledby={`perm-group-${group.key}`}>
          <h5 id={`perm-group-${group.key}`} className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h5>
          <ul>
            {items.map((p) => {
              const offArea = offAreaFor?.(p.name);
              const inputId = `perm-${p.id}`;
              const text = (
                <span>
                  <span className="flex items-center gap-1 font-medium">
                    {permissionLabel(p.name)}
                    {offArea ? <Lock className="h-3.5 w-3.5" aria-label="Turned off for this school" /> : null}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">{p.name}</span>
                  {offArea ? (
                    <span className="block text-xs text-muted-foreground">
                      Part of {offArea.label}, which is turned off for this school.
                    </span>
                  ) : null}
                </span>
              );
              return (
                <li key={p.id} className={`flex items-start gap-2 rounded px-3 py-1.5 ${offArea ? 'opacity-60' : ''}`}>
                  {editable ? (
                    <>
                      <input
                        id={inputId}
                        type="checkbox"
                        className="mt-1 size-4"
                        checked={selected?.includes(p.name) ?? false}
                        onChange={() => onToggle?.(p.name)}
                        disabled={disabled || Boolean(offArea)}
                      />
                      <label htmlFor={inputId} className={offArea || disabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
                        {text}
                      </label>
                    </>
                  ) : (
                    <>
                      {offArea ? null : <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />}
                      {text}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
