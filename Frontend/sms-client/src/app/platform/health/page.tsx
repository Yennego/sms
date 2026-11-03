'use client';

import { useState, useEffect } from 'react';
import { useSuperAdminService, SystemMetrics } from '@/services/api/super-admin-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function Figure({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value ?? 'Not measured'}</dd>
    </div>
  );
}

function numberOrNone(value: number | null): string | null {
  return value === null || value === undefined ? null : String(value);
}

function formatBytes(bytes: number | null): string | null {
  if (bytes === null || bytes === undefined) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export default function SystemHealthPage() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const superAdminService = useSuperAdminService();
  
  useEffect(() => {
    const fetchSystemMetrics = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const metrics = await superAdminService.getSystemMetrics();
        setSystemMetrics(metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load system metrics');
        console.error('Error fetching system metrics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSystemMetrics();
  }, [superAdminService]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">System Health</h1>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-4">Loading system metrics...</div>
      ) : systemMetrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Measured figures only: host CPU, memory and disk aren't visible on managed hosting */}
          <Card>
            <CardHeader>
              <CardTitle>System</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Figure label="Database size" value={formatBytes(systemMetrics.databaseSizeBytes)} />
                <Figure label="Open database connections" value={numberOrNone(systemMetrics.activeConnections)} />
                <Figure
                  label="Database response"
                  value={systemMetrics.databaseResponseMs === null ? null : `${systemMetrics.databaseResponseMs} ms`}
                />
                <Figure label="API running for" value={formatDuration(systemMetrics.apiUptimeSeconds)} />
              </dl>
              <p className="mt-4 text-sm text-muted-foreground">
                CPU, memory and disk use aren&apos;t measured here. Check them on your hosting provider&apos;s dashboard.
              </p>
            </CardContent>
          </Card>
          
          {/* System Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {systemMetrics.alerts && systemMetrics.alerts.length > 0 ? (
                <div className="space-y-4">
                  {systemMetrics.alerts.map((alert, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-md ${
                        alert.level === 'info' ? 'bg-blue-50 text-blue-700' :
                        alert.level === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-red-50 text-red-700'
                      }`}
                    >
                      {alert.message}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-green-600">No active alerts. All systems operational.</p>
              )}
            </CardContent>
          </Card>
          
          {/* Tenant Growth Chart */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Tenant Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-end justify-between">
                {systemMetrics.tenantGrowth && systemMetrics.tenantGrowth.map((data, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div 
                      className="bg-blue-500 w-16 rounded-t-md" 
                      style={{ height: `${data.tenants * 10}px` }}
                    ></div>
                    <div className="mt-2 text-sm">{data.month}</div>
                    <div className="text-xs text-gray-500">{data.tenants}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-4">No system metrics available</div>
      )}
    </div>
  );
}