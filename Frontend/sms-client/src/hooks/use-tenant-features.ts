import { useQuery } from '@tanstack/react-query';
import { useTenantService } from '@/services/api/tenant-service';
import { useTenant } from '@/hooks/use-tenant';

/**
 * Hook to fetch the current tenant's feature flags.
 * Returns a map of feature names to their enabled/disabled status.
 * Falls back to all features disabled if settings cannot be fetched.
 */
export function useTenantFeatures() {
    const { tenantId } = useTenant();
    const tenantService = useTenantService();

    const { data: settings } = useQuery({
        queryKey: ['tenant-settings', tenantId],
        queryFn: () => tenantService.getSettings(tenantId!),
        enabled: !!tenantId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 1,
    });

    const features = settings?.settings?.features ?? {};

    return {
        isFeatureEnabled: (featureKey: string): boolean => {
            return features[featureKey] === true;
        },
        features,
    };
}
