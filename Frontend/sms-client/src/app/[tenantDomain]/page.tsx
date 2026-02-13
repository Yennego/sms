'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/use-tenant';
import { useTenantNavigation } from '@/hooks/use-tenant';

export default function TenantPage({ params }: { params: Promise<{ tenantDomain: string }> }) {
  // Use React.use() to unwrap the params Promise

    // const unwrappedParams = use(params);
    const { tenantDomain } = use(params);

  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { setTenant } = useTenant();
  const { createTenantPath } = useTenantNavigation();

  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        setLoading(true);
        // Fetch tenant data using the domain
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tenants/?domain=${tenantDomain}`);
        
        // Check content type before parsing as JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Backend returned non-JSON response');
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          // Set the tenant in context
          setTenant(data[0]);
          // Store tenant ID in localStorage
          localStorage.setItem('tenantId', data[0].id);
          // Redirect to dashboard using UUID-based routing
          router.push(createTenantPath('/dashboard'));
        } else {
          setError('Tenant not found');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (tenantDomain) {
      fetchTenantData();
    }
  }, [tenantDomain, router, setTenant, createTenantPath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading tenant data...</h2>
          <p className="text-gray-500">Please wait while we set up your environment.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Error</h2>
          <p className="text-gray-700">{error}</p>
          <button 
            onClick={() => router.push('/login')} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // This should not be visible as we redirect on successful tenant fetch
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Setting up your environment...</h2>
        <p className="text-gray-500">You&apos;ll be redirected shortly.</p>
      </div>
    </div>
  );
}
