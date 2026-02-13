'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SuperAdminDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentTenantDomain, setCurrentTenantDomain] = useState<string | null>(null);
  const [currentTenantName, setCurrentTenantName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Get tenant from URL query parameter
    const tenantParam = searchParams.get('tenant');
    
    if (tenantParam) {
      setCurrentTenantDomain(tenantParam);
      // Try to get tenant name from localStorage
      const storedTenantName = localStorage.getItem('currentTenantName');
      if (storedTenantName) {
        setCurrentTenantName(storedTenantName);
      }
    } else {
      // Check if we have a stored tenant domain
      const storedTenantDomain = localStorage.getItem('currentTenantDomain');
      const storedTenantName = localStorage.getItem('currentTenantName');
      
      if (storedTenantDomain) {
        setCurrentTenantDomain(storedTenantDomain);
        if (storedTenantName) {
          setCurrentTenantName(storedTenantName);
        }
      }
    }
    
    setIsLoading(false);
  }, [searchParams]);
  
  const handleViewTenant = () => {
    if (currentTenantDomain) {
      // Navigate to tenant-specific dashboard
      window.open(`http://localhost:3000/${currentTenantDomain}/dashboard`, '_blank');
    }
  };
  
  const handleBackToGlobal = () => {
    // Clear tenant context and go back to global dashboard
    localStorage.removeItem('currentTenantDomain');
    localStorage.removeItem('currentTenantName');
    router.replace('/super-admin/dashboard');
    setCurrentTenantDomain(null);
    setCurrentTenantName(null);
  };
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {currentTenantDomain 
            ? `Super Admin Dashboard (${currentTenantName || currentTenantDomain})` 
            : 'Global Super Admin Dashboard'}
        </h1>
        
        {currentTenantDomain ? (
          <div className="flex space-x-4">
            <Button onClick={handleViewTenant} variant="outline">
              View Tenant Dashboard
            </Button>
            <Button onClick={handleBackToGlobal} variant="secondary">
              Back to Global Dashboard
            </Button>
          </div>
        ) : null}
      </div>
      
      {/* Super Admin specific dashboard content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Information</CardTitle>
          </CardHeader>
          <CardContent>
            {currentTenantDomain ? (
              <div>
                <p><strong>Domain:</strong> {currentTenantDomain}</p>
                <p><strong>Name:</strong> {currentTenantName || 'Unknown'}</p>
              </div>
            ) : (
              <p>Viewing global dashboard</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Tenant Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Total Tenants: 15</p>
            <p>Active Tenants: 12</p>
            <p>New Tenants This Month: 3</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <p>System Uptime: 99.9%</p>
            <p>API Requests Today: 5,432</p>
            <p>Database Size: 1.2 GB</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}