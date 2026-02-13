'use client';

import { useState, useEffect } from 'react';
import { useSuperAdminService, SystemMetrics } from '@/services/api/super-admin-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  
  const getStatusColor = (value: number): string => {
    if (value < 50) return 'text-green-500';
    if (value < 80) return 'text-yellow-500';
    return 'text-red-500';
  };
  
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
          {/* System Resource Usage */}
          <Card>
            <CardHeader>
              <CardTitle>System Resource Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>CPU Usage</span>
                    <span className={getStatusColor(systemMetrics.cpuUsage)}>{systemMetrics.cpuUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${systemMetrics.cpuUsage < 50 ? 'bg-green-500' : systemMetrics.cpuUsage < 80 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                      style={{ width: `${systemMetrics.cpuUsage}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Memory Usage</span>
                    <span className={getStatusColor(systemMetrics.memoryUsage)}>{systemMetrics.memoryUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${systemMetrics.memoryUsage < 50 ? 'bg-green-500' : systemMetrics.memoryUsage < 80 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                      style={{ width: `${systemMetrics.memoryUsage}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Disk Usage</span>
                    <span className={getStatusColor(systemMetrics.diskUsage)}>{systemMetrics.diskUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${systemMetrics.diskUsage < 50 ? 'bg-green-500' : systemMetrics.diskUsage < 80 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                      style={{ width: `${systemMetrics.diskUsage}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <p><strong>Active Connections:</strong> {systemMetrics.activeConnections}</p>
                </div>
              </div>
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