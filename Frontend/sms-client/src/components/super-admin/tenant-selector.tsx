'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Tenant } from '@/types/tenant';

export function TenantSelector() {
  const { selectedTenantId, setSelectedTenant } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  
  useEffect(() => {
    // Fetch available tenants for super-admin
    fetch('/api/super-admin/tenants')
      .then(res => res.json())
      .then((data: Tenant[]) => setTenants(data))
      .catch(error => {
        console.error('Failed to fetch tenants:', error);
        setTenants([]);
      });
  }, []);
  
  return (
    <select 
      value={selectedTenantId || ''} 
      onChange={(e) => setSelectedTenant(e.target.value || null)}
      className="border rounded px-3 py-2"
    >
      <option value="">All Tenants</option>
      {tenants.map(tenant => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.name}
        </option>
      ))}
    </select>
  );
}