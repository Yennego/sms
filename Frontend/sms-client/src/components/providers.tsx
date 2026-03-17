"use client";

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TenantProvider } from '@/contexts/tenant-context';
import { AuthProvider } from '@/contexts/auth-context';
import { AcademicYearProvider } from '@/contexts/academic-year-context';

import { queryClient } from '@/lib/query-client';

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