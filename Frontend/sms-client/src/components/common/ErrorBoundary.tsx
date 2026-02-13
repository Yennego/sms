'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTenantNavigation } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error?: Error; resetError: () => void }> = ({ error, resetError }) => {
  const router = useRouter();
  const { createTenantPath } = useTenantNavigation();
  const { user } = useAuth();

  const handleGoHome = () => {
    // Smart redirect based on current location and user role
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/super-admin')) {
      router.push('/super-admin/dashboard');
    } else {
      // Role-based redirect for tenant users
      const userRole = user?.role || 
        (Array.isArray(user?.roles) && user.roles.length > 0 ? 
          (typeof user.roles[0] === 'string' ? 
            user.roles[0] : 
            user.roles[0].name) : 
          'admin');
      
      if (userRole === 'super_admin' || userRole === 'super-admin' || userRole === 'superadmin') {
        router.push('/super-admin/dashboard');
      } else if (userRole === 'admin') {
        router.push(createTenantPath('/admin-dashboard'));
      } else if (userRole === 'teacher') {
        router.push(createTenantPath('/teacher/dashboard'));
      } else if (userRole === 'student') {
        router.push(createTenantPath('/student/dashboard'));
      } else {
        router.push(createTenantPath('/dashboard'));
      }
    }
  };

  const handleTryAgain = () => {
    resetError();
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-red-500">
            <AlertTriangle className="h-full w-full" />
          </div>
          <CardTitle className="text-red-600">Something went wrong!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 text-center">
            An unexpected error has occurred. Our team has been notified.
          </p>
          
          {error && (
            <details className="text-sm text-gray-500">
              <summary className="cursor-pointer font-medium">Error Details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {error.message}
              </pre>
            </details>
          )}
          
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={handleTryAgain}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={handleGoHome}>
              <Home className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorBoundary;