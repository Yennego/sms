import { useQuery } from '@tanstack/react-query';
import { useTenantService } from '@/services/api/tenant-service';
import { useTenant } from '@/hooks/use-tenant';
import { FEATURE_DEFAULTS, type SchoolArea } from '@/config/school-areas';

/**
 * Hook to fetch the current tenant's feature flags.
 * Returns a map of feature names to their enabled/disabled status.
 * A switch the school's settings don't mention takes FEATURE_DEFAULTS (off when unknown).
 */
export function useTenantFeatures() {
    const { tenantId } = useTenant();
    const tenantService = useTenantService();

    const { data: settings, isLoading } = useQuery({
        queryKey: ['tenant-settings', tenantId],
        queryFn: () => tenantService.getSettings(tenantId!),
        enabled: !!tenantId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 1,
    });

    const features = settings?.settings?.features ?? {};

    return {
        isFeatureEnabled: (featureKey: string): boolean => {
            if (featureKey in features) return features[featureKey] === true;
            return FEATURE_DEFAULTS[featureKey] === true;
        },
        features,
        /** True until the school's settings have loaded (or failed to). */
        isLoading: Boolean(tenantId) && isLoading,
    };
}

/** The switchable areas with whether this school has each one (the role screens grey the rest). */
export function useSchoolAreas() {
    const { tenantId } = useTenant();
    const tenantService = useTenantService();
    const { data, isLoading } = useQuery({
        queryKey: ['school-areas', tenantId],
        queryFn: () => tenantService.getAreas(),
        enabled: !!tenantId,
        staleTime: 5 * 60 * 1000,
    });
    const areas: SchoolArea[] = data ?? [];
    const offPermissions = new Set(areas.filter((a) => !a.enabled).flatMap((a) => a.permissions));
    return {
        areas,
        isLoading: Boolean(tenantId) && isLoading,
        /** The area that is switched off for this permission, if any */
        offAreaFor: (permission: string) =>
            offPermissions.has(permission) ? areas.find((a) => !a.enabled && a.permissions.includes(permission)) : undefined,
    };
}
