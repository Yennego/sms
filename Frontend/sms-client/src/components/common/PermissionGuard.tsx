'use client';

import { useAuth } from '@/hooks/use-auth';
import { ReactNode } from 'react';

interface PermissionGuardProps {
    children: ReactNode;
    permissions?: string[];
    roles?: string[];
    fallback?: ReactNode;
}

/**
 * PermissionGuard
 * 
 * Conditionally renders children based on user permissions or roles.
 * 
 * Example:
 * <PermissionGuard permissions={['manage_assignments']} roles={['admin', 'teacher']}>
 *   <button>Create Assignment</button>
 * </PermissionGuard>
 */
export function PermissionGuard({
    children,
    permissions = [],
    roles = [],
    fallback = null
}: PermissionGuardProps) {
    const { user } = useAuth();

    if (!user) return fallback;

    // Normalized role for comparison
    const userRole = user.role?.toLowerCase().replace(/[-_]/g, '') || '';
    const normalizedRoles = roles.map(r => r.toLowerCase().replace(/[-_]/g, ''));

    // Check roles first
    const hasRole = normalizedRoles.length === 0 || normalizedRoles.includes(userRole);

    // Check permissions
    const userPermissions = user.permissions || [];
    const hasPermission = permissions.length === 0 || permissions.every(p => userPermissions.includes(p));

    if (hasRole && hasPermission) {
        return <>{children}</>;
    }

    return fallback;
}
