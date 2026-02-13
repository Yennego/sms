'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Add state for countdown timer
  const [waitTime, setWaitTime] = useState(0);
  // Destructure user and requiresPasswordChange from useAuth for logging
  const { login, isAuthenticated, user, requiresPasswordChange } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // In the useEffect where you handle authentication redirect
  useEffect(() => {
    console.log('--- LoginPage useEffect running ---');
    console.log('isAuthenticated (from useAuth):', isAuthenticated);
    console.log('user (from useAuth):', user);
    console.log('requiresPasswordChange (from useAuth):', requiresPasswordChange);
  
    const registered = searchParams.get('registered');
    if (registered === 'true') {
      setMessage('Registration successful! Please log in with your new account.');
    }
    
    // Check if user is already authenticated
    if (isAuthenticated && user) {
      console.log('LoginPage useEffect: User is authenticated, determining correct dashboard');
      
      // Check if user is a super-admin
      const isSuperAdmin = 
        user?.role === 'super-admin' || 
        user?.role === 'superadmin' ||
        (Array.isArray(user?.roles) && user.roles.some(role => 
          typeof role === 'string' 
            ? (role === 'super-admin' || role === 'superadmin')
            : (role.name === 'super-admin' || role.name === 'superadmin')
        ));
      
      if (isSuperAdmin) {
        console.log('LoginPage useEffect: Super admin detected, redirecting to /super-admin/dashboard');
        router.push('/super-admin/dashboard');
      } else {
        // For regular users, check if they have a tenant_id
        const tenantId = user.tenantId;
        if (tenantId && tenantId !== 'None' && tenantId !== 'null') {
          // Redirect to role-specific dashboard based on user role
          const userRole = user.role || 
            (Array.isArray(user?.roles) && user.roles.length > 0 ? 
              (typeof user.roles[0] === 'string' ? 
                user.roles[0] : 
                user.roles[0].name) : 
              'admin');
          
          console.log('LoginPage useEffect: Regular user with tenant, redirecting to role-specific dashboard using UUID');
          
          if (userRole === 'admin') {
            router.push(`/${tenantId}/admin-dashboard`);
          } else if (userRole === 'teacher') {
            router.push(`/${tenantId}/teacher/dashboard`);
          } else if (userRole === 'student') {
            router.push(`/${tenantId}/student/dashboard`);
          } else {
            // Fallback to generic dashboard for unknown roles
            router.push(`/${tenantId}/dashboard`);
          }
        } else {
          console.log('LoginPage useEffect: User without tenant, redirecting to /dashboard');
          router.push('/dashboard');
        }
      }
    }
  }, [isAuthenticated, router, searchParams, user, requiresPasswordChange]);

  // Add countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (waitTime > 0) {
      timer = setInterval(() => {
        setWaitTime(prevTime => {
          if (prevTime <= 1) {
            // Clear error message when timer reaches zero
            setError('');
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [waitTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    console.log('--- handleSubmit: attempting login ---')
  
    try {
      const result = await login(email, password);
      console.log('handleSubmit: Login function resolved. Result:', result);
  
      // Log the current state variables *after* the login promise resolves
      console.log('handleSubmit: isAuthenticated after login call:', isAuthenticated);
      console.log('handleSubmit: user after login call:', user);
      console.log('handleSubmit: requiresPasswordChange after login call:', requiresPasswordChange);
      
      // Check if password change is required
      if (result?.requiresPasswordChange) {
        console.log('handleSubmit: Password change required, redirecting to /change-password');
        router.push('/change-password');
      } else {
        // Check if user is a super-admin
        const isSuperAdmin = 
          (result?.user?.role === 'super-admin' || result?.user?.role === 'superadmin') ||
          (Array.isArray(result?.user?.roles) && result.user.roles.some(role => 
            typeof role === 'string' 
              ? (role === 'super-admin' || role === 'superadmin')
              : (role.name === 'super-admin' || role.name === 'superadmin')
          ));
        
        if (isSuperAdmin) {
          console.log('handleSubmit: Super admin login, redirecting to /super-admin/dashboard');
          router.push('/super-admin/dashboard');
        } else {
          // For regular users, determine the correct tenant dashboard
          const tenantId = result?.user?.tenantId;
          if (tenantId && tenantId !== 'None' && tenantId !== 'null') {
            // Always use tenant UUID for consistent routing
            console.log('handleSubmit: Regular user with tenant, redirecting to tenant dashboard using UUID');
            router.push(`/${tenantId}/dashboard`);
          } else {
            console.log('handleSubmit: User without tenant, redirecting to /dashboard');
            router.push('/dashboard');
          }
        }
      }
    } catch (err: Error | unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to login';
      
      // Check if it's a rate limiting error
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        // Extract wait time from error message if available
        const waitTimeMatch = errorMessage.match(/wait (\d+) seconds/i);
        const waitTimeValue = waitTimeMatch ? parseInt(waitTimeMatch[1], 10) : 30;
        
        setWaitTime(waitTimeValue);
        setError(`Too many login attempts. Please wait ${waitTimeValue} seconds before trying again.`);
      } else {
        setError(errorMessage);
      }
      console.error('handleSubmit: Login failed:', errorMessage);
    } finally {
      setIsLoading(false);
      console.log('--- handleSubmit: Login process finished ---');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              create a new account
            </Link>
          </p>
        </div>

        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{message}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">
              {waitTime > 0 
                ? `Too many login attempts. Please wait ${waitTime} seconds before trying again.` 
                : error}
            </span>
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
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || waitTime > 0}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : waitTime > 0 ? `Wait ${waitTime}s` : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}