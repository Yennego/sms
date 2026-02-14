'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useTenant, useTenantNavigation } from '@/hooks/use-tenant';
import React from 'react';
import { useParams } from 'next/navigation';

export default function TenantLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);

  const { login, isAuthenticated } = useAuth();
  const { tenant, setTenant } = useTenant();
  const { createTenantPath } = useTenantNavigation();
  const router = useRouter();
  const { tenantDomain } = useParams<{ tenantDomain: string }>();

  // Fetch tenant information
  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        setTenantLoading(true);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const cookieStr = typeof document !== 'undefined' ? document.cookie : '';
        const match = cookieStr.match(/(?:^|; )tn_tenantId=([^;]+)/) || cookieStr.match(/(?:^|; )tenantId=([^;]+)/);
        const cookieTenantId = match ? decodeURIComponent(match[1]) : (localStorage.getItem('tenantId') || '');
        if (cookieTenantId && uuidRegex.test(cookieTenantId)) {
          const respById = await fetch(`/api/tenants/${cookieTenantId}`);
          if (respById.ok) {
            const tenantData = await respById.json();
            if (tenantData && tenantData.id) {
              setTenant(tenantData);
              localStorage.setItem('tenantId', tenantData.id);
              setTenantError(null);
              return;
            }
          }
        }
        const response = await fetch(`/api/tenants/by-domain/?domain=${encodeURIComponent(tenantDomain)}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const tenantData = Array.isArray(data) ? (data[0] ?? null) : data;

        if (tenantData && tenantData.id) {
          setTenant(tenantData);
          localStorage.setItem('tenantId', tenantData.id);
          setTenantError(null);
        } else {
          setTenantError('Tenant not found or inactive');
        }
      } catch (e) {
        setTenantError(e instanceof Error ? e.message : 'An error occurred');
      } finally {
        setTenantLoading(false);
      }
    };

    if (tenantDomain) {
      fetchTenantData();
    }
  }, [tenantDomain, setTenant]);

  // Check if user is already authenticated
  const redirectBasedOnRole = React.useCallback(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'super_admin' || userRole === 'super-admin' || userRole === 'superadmin') {
      // Store the current tenant domain for super-admin to access later
      if (tenant) {
        localStorage.setItem('currentTenantDomain', tenantDomain);
        localStorage.setItem('currentTenantName', tenant.name);
        // Redirect to tenant-specific super-admin dashboard using tenant UUID
        router.push(`/super-admin/dashboard?tenant=${tenant.id}`);
      } else {
        // Fallback to global dashboard if tenant info is missing
        router.push('/super-admin/dashboard');
      }
    } else if (userRole === 'admin') {
      router.push(createTenantPath('/admin-dashboard'));
    } else if (userRole === 'teacher') {
      router.push(createTenantPath('/teacher/dashboard'));
    } else if (userRole === 'student') {
      router.push(createTenantPath('/student/dashboard'));
    } else {
      router.push(createTenantPath('/dashboard'));
    }
  }, [tenant, tenantDomain, router, createTenantPath]);

  useEffect(() => {
    if (isAuthenticated && tenant) {
      redirectBasedOnRole();
    }
  }, [isAuthenticated, tenant, redirectBasedOnRole]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    console.log('[Login] Submitting login request (Fix v1.1) with explicit tenantId:', tenant?.id);

    try {
      const normalizedEmail = email.toLowerCase().trim();
      // Pass tenant.id explicitly to avoid cookie race conditions
      const result = await login(normalizedEmail, password, tenant?.id);

      // Check if the user is a super-admin based on role or roles array
      const isSuperAdmin =
        result?.user?.role === 'super-admin' ||
        result?.user?.role === 'superadmin' ||
        (Array.isArray(result?.user?.roles) && result.user.roles.some(role =>
          typeof role === 'string'
            ? (role === 'super-admin' || role === 'superadmin')
            : (role.name === 'super-admin' || role.name === 'superadmin')
        ));

      // Store user role for redirects
      if (result?.user) {
        let userRole = result.user.role;

        // If role is missing, check user type (common for students/teachers)
        if (!userRole && result.user.type) {
          userRole = result.user.type;
        }

        // If still missing, check roles array
        if (!userRole && Array.isArray(result.user.roles) && result.user.roles.length > 0) {
          const firstRole = result.user.roles[0];
          userRole = typeof firstRole === 'string' ? firstRole : firstRole.name;
        }

        // Normalize role to lowercase
        if (userRole) {
          userRole = userRole.toLowerCase();
        }

        const finalRole = isSuperAdmin ? 'superadmin' : (userRole || 'user');
        console.log('[Login] Derived user role:', finalRole, 'from:', result.user);
        localStorage.setItem('userRole', finalRole);
      }

      // Check if password change is required
      if (result?.requiresPasswordChange) {
        router.push(createTenantPath('/change-password'));
      } else {
        redirectBasedOnRole();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to login';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading tenant data...</h2>
          <p className="text-gray-500">Please wait while we set up your environment.</p>
        </div>
      </div>
    );
  }

  if (tenantError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Tenant Error</h2>
          <p className="text-gray-700">{tenantError}</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Main Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {(() => {
              const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
              if (tenant?.name && tenant.name.trim()) return `Sign in to ${tenant.name}`;
              const paramDomain = (tenantDomain as string) || '';
              const domain = (tenant?.domain || '').toLowerCase();
              const effective = paramDomain || (domain !== 'unknown' ? domain : '');
              return `Sign in to ${effective ? titleCase(effective) : 'your account'}`;
            })()}
          </h2>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
