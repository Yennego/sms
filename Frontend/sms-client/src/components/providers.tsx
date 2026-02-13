"use client";

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TenantProvider } from '@/contexts/tenant-context';
import { AuthProvider } from '@/contexts/auth-context';
import { AcademicYearProvider } from '@/contexts/academic-year-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // Data is fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Cache is kept for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      retry: 1, // Retry failed requests once
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TenantProvider>
        {/* Add AcademicYearProvider so pages can access selected year */}
        <AcademicYearProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </AcademicYearProvider>
      </TenantProvider>
    </AuthProvider>
  );
}