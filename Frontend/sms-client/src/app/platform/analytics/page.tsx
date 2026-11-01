'use client';

import { useState } from 'react';
import { useGrowthForecast, useAnomalyAlerts, useChurnRisk } from '@/hooks/queries/analytics';
import type { ForecastDataPoint, AnomalyAlert, ChurnRiskTenant } from '@/hooks/queries/analytics';

export default function AnalyticsPage() {
    const { data: forecast, isLoading: forecastLoading } = useGrowthForecast();
    const { data: anomalies, isLoading: anomaliesLoading } = useAnomalyAlerts();
    const { data: churnData, isLoading: churnLoading } = useChurnRisk();

    const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'revenue'>('tenants');

    // Merge history + forecast for chart display
    const getChartData = (category: 'tenants' | 'users' | 'revenue') => {
        if (!forecast) return [];
        const cat = forecast[category];
        return [...(cat.history || []), ...(cat.forecast || [])];
    };

    const chartData = getChartData(activeTab);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'error': return 'bg-red-100 text-red-800 border-red-200';
            case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getSeverityDot = (severity: string) => {
        switch (severity) {
            case 'error': return 'bg-red-500';
            case 'warning': return 'bg-amber-500';
            case 'info': return 'bg-blue-500';
            default: return 'bg-gray-500';
        }
    };

    const getRiskBadge = (level: string) => {
        switch (level) {
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getScoreBarColor = (score: number) => {
        if (score >= 70) return 'bg-red-500';
        if (score >= 40) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">AI Analytics</h1>
                <p className="text-gray-500 mt-1">Growth forecasting, anomaly detection, and churn prediction</p>
            </div>

            {/* ── Growth Forecast Section ─────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">📈 Growth Forecast</h2>
                        <p className="text-sm text-gray-500">Historical trends with 3-month projections</p>
                    </div>

                    {/* Tab Switch */}
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {(['tenants', 'users', 'revenue'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === tab
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {forecastLoading ? (
                    <div className="h-64 flex items-center justify-center text-gray-400">Loading forecast data...</div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                                <div className="text-sm font-medium text-blue-600 uppercase tracking-wider">Current</div>
                                <div className="text-2xl font-bold text-blue-900 mt-1">
                                    {activeTab === 'revenue' ? `$${(forecast?.[activeTab]?.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : (forecast?.[activeTab]?.current || 0).toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
                                <div className="text-sm font-medium text-emerald-600 uppercase tracking-wider">Projected (3 mo)</div>
                                <div className="text-2xl font-bold text-emerald-900 mt-1">
                                    {activeTab === 'revenue' ? `$${(forecast?.[activeTab]?.projected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : (forecast?.[activeTab]?.projected || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="h-64 relative">
                            {chartData.length > 0 ? (
                                <div className="flex items-end h-full gap-1 px-2">
                                    {chartData.map((point, i) => {
                                        const maxVal = Math.max(...chartData.map(d => d.value), 1);
                                        const height = (point.value / maxVal) * 100;
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                                {/* Tooltip */}
                                                <div className="hidden group-hover:block absolute bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                                    {point.month}: {activeTab === 'revenue' ? `$${point.value.toLocaleString()}` : point.value}
                                                </div>
                                                <div
                                                    className={`w-full rounded-t-sm transition-all ${point.type === 'forecast'
                                                            ? 'bg-emerald-300 border-2 border-dashed border-emerald-400'
                                                            : 'bg-blue-500'
                                                        }`}
                                                    style={{ height: `${Math.max(height, 2)}%` }}
                                                />
                                                <span className="text-[9px] text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                                                    {point.month.split(' ')[0]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400">No data available</div>
                            )}
                        </div>

                        {/* Legend */}
                        <div className="flex gap-6 mt-3 justify-center">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <div className="w-3 h-3 rounded-sm bg-blue-500" />
                                Historical
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <div className="w-3 h-3 rounded-sm bg-emerald-300 border border-dashed border-emerald-400" />
                                Projected
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Two Column: Anomalies + Churn ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Anomaly Alerts */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">🚨 Anomaly Alerts</h2>
                    <p className="text-sm text-gray-500 mb-4">Unusual patterns detected across tenants</p>

                    {anomaliesLoading ? (
                        <div className="h-40 flex items-center justify-center text-gray-400">Loading alerts...</div>
                    ) : !anomalies || anomalies.length === 0 ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
                            <div className="text-emerald-600 font-medium">✅ All Clear</div>
                            <div className="text-sm text-emerald-500 mt-1">No anomalies detected across tenants</div>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {anomalies.map((alert: AnomalyAlert, i: number) => (
                                <div key={i} className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                                    <div className="flex items-start gap-2">
                                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getSeverityDot(alert.severity)}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">{alert.tenant_name}</div>
                                            <div className="text-xs mt-0.5 opacity-80">{alert.message}</div>
                                            <div className="text-[10px] mt-1 uppercase tracking-wider opacity-60">
                                                {alert.type.replace(/_/g, ' ')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Churn Risk */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">⚠️ Churn Risk</h2>
                    <p className="text-sm text-gray-500 mb-4">Tenants at risk of disengagement</p>

                    {churnLoading ? (
                        <div className="h-40 flex items-center justify-center text-gray-400">Loading churn data...</div>
                    ) : !churnData || churnData.length === 0 ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
                            <div className="text-emerald-600 font-medium">✅ All Healthy</div>
                            <div className="text-sm text-emerald-500 mt-1">No tenants at risk of churning</div>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {churnData.map((tenant: ChurnRiskTenant) => (
                                <div key={tenant.tenant_id} className="p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-medium text-sm text-gray-900">{tenant.tenant_name}</div>
                                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getRiskBadge(tenant.risk_level)}`}>
                                            {tenant.risk_level}
                                        </span>
                                    </div>

                                    {/* Score Bar */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${getScoreBarColor(tenant.churn_score)}`}
                                                style={{ width: `${tenant.churn_score}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-gray-600 w-8 text-right">{tenant.churn_score}</span>
                                    </div>

                                    {/* Factors */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-gray-500">
                                        <span>Last login: {tenant.factors.days_since_login}d ago</span>
                                        <span>Inactive: {tenant.factors.inactive_users_pct}%</span>
                                        <span>Activity (30d): {tenant.factors.activity_30d}</span>
                                        <span>Revenue: ${tenant.factors.monthly_revenue}</span>
                                    </div>

                                    {/* Recommendation */}
                                    <div className="text-xs text-gray-600 mt-2 bg-gray-50 rounded p-2 italic">
                                        💡 {tenant.recommendation}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
