'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuperAdminApiClient } from '@/services/api/super-admin-api-client';
import { useTenant } from '@/hooks/use-tenant';

// ─── Types ───────────────────────────────────────────────────────

export interface ForecastDataPoint {
    month: string;
    value: number;
    type: 'historical' | 'forecast';
}

export interface GrowthForecastCategory {
    history: ForecastDataPoint[];
    forecast: ForecastDataPoint[];
    current: number;
    projected: number;
}

export interface GrowthForecast {
    tenants: GrowthForecastCategory;
    users: GrowthForecastCategory;
    revenue: GrowthForecastCategory;
}

export interface AnomalyAlert {
    tenant_id: string;
    tenant_name: string;
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    metric: Record<string, number>;
}

export interface ChurnRiskTenant {
    tenant_id: string;
    tenant_name: string;
    churn_score: number;
    risk_level: 'high' | 'medium' | 'low';
    factors: {
        days_since_login: number;
        inactive_users_pct: number;
        activity_30d: number;
        monthly_revenue: number;
    };
    recommendation: string;
}

// ─── Query Keys ──────────────────────────────────────────────────
export const analyticsKeys = {
    all: (tenantKey: string | null) => ['analytics', tenantKey] as const,
    growthForecast: (tenantKey: string | null) => [...analyticsKeys.all(tenantKey), 'growth-forecast'] as const,
    anomalies: (tenantKey: string | null) => [...analyticsKeys.all(tenantKey), 'anomalies'] as const,
    churnRisk: (tenantKey: string | null) => [...analyticsKeys.all(tenantKey), 'churn-risk'] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────

export function useGrowthForecast() {
    const { tenantId, tenantKey } = useTenant();
    const apiClient = useSuperAdminApiClient(tenantId || undefined);

    return useQuery({
        queryKey: analyticsKeys.growthForecast(tenantKey),
        queryFn: () => apiClient.get<GrowthForecast>('/super-admin/analytics/growth-forecast'),
        staleTime: 5 * 60 * 1000, // 5 min cache
    });
}

export function useAnomalyAlerts() {
    const { tenantId, tenantKey } = useTenant();
    const apiClient = useSuperAdminApiClient(tenantId || undefined);

    return useQuery({
        queryKey: analyticsKeys.anomalies(tenantKey),
        queryFn: () => apiClient.get<AnomalyAlert[]>('/super-admin/analytics/anomalies'),
        staleTime: 2 * 60 * 1000, // 2 min cache
    });
}

export function useChurnRisk() {
    const { tenantId, tenantKey } = useTenant();
    const apiClient = useSuperAdminApiClient(tenantId || undefined);

    return useQuery({
        queryKey: analyticsKeys.churnRisk(tenantKey),
        queryFn: () => apiClient.get<ChurnRiskTenant[]>('/super-admin/analytics/churn-risk'),
        staleTime: 5 * 60 * 1000, // 5 min cache
    });
}
