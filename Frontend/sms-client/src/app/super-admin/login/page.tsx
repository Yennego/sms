'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, LogIn, Mail, Lock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Suspense } from 'react';

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // If already authenticated as super admin, redirect to dashboard
    if (isAuthenticated && user) {
      const isSuperAdmin =
        user?.role === 'super-admin' ||
        user?.role === 'superadmin' ||
        (Array.isArray(user?.roles) && user.roles.some(role =>
          typeof role === 'string'
            ? (role === 'super-admin' || role === 'superadmin')
            : (role.name === 'super-admin' || role.name === 'superadmin')
        ));

      if (isSuperAdmin) {
        router.push('/super-admin/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Super admin login doesn't need a specific tenant context during initial AUTH
      // The backend will identify the super admin by their email/role
      const result = await login(email.toLowerCase().trim(), password);
      
      const isSuperAdmin =
        (result?.user?.role === 'super-admin' || result?.user?.role === 'superadmin') ||
        (Array.isArray(result?.user?.roles) && result.user.roles.some((role: any) =>
          typeof role === 'string'
            ? (role === 'super-admin' || role === 'superadmin')
            : (role.name === 'super-admin' || role.name === 'superadmin')
        ));

      if (isSuperAdmin) {
        router.push('/super-admin/dashboard');
      } else {
        setError('This login is for Super Admins only.');
        // Don't log out, just show error. They might be a regular admin on the wrong page.
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
          <p className="text-slate-500">Super Admin Authentication</p>
        </div>

        <Card className="border-slate-200 shadow-xl shadow-slate-200/50">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@foundation.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-11 border-slate-200 focus:ring-primary focus:border-primary"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 h-11 border-slate-200 focus:ring-primary focus:border-primary"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.01]" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In to Console
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-slate-500">
            Forgot your credentials? Contact System Support
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading authenticaton...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
