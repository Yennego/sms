"use client";

import React, { createContext, useContext, useEffect, useMemo, useCallback, useState, ReactNode } from 'react';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { AcademicYear } from '@/types/enrollment';
import { useTenant } from '@/hooks/use-tenant';
import { useAuth } from '@/hooks/use-auth';

type AcademicYearContextValue = {
  academicYears: AcademicYear[];
  selectedAcademicYearId?: string;
  selectedAcademicYearName?: string;
  isLoading: boolean;
  setSelectedAcademicYearId: (id?: string) => void;
  setSelectedAcademicYearName: (name?: string) => void;
};

const AcademicYearContext = createContext<AcademicYearContextValue | undefined>(undefined);

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const enrollmentService = useEnrollmentService();
  // Keep a stable ref to service to strictly avoid effect triggering on service recreation
  // (though service should be stable now)
  const enrollmentServiceRef = React.useRef(enrollmentService);
  useEffect(() => {
    enrollmentServiceRef.current = enrollmentService;
  }, [enrollmentService]);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearIdState] = useState<string | undefined>(undefined);
  const [selectedAcademicYearName, setSelectedAcademicYearNameState] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Add auth context
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isUuid = (str?: string | null) =>
        !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      if (tenantLoading || authLoading || !isUuid(tenantId) || !isAuthenticated) {
        if (!cancelled) {
          setAcademicYears([]);
          setSelectedAcademicYearIdState(undefined);
          setSelectedAcademicYearNameState(undefined);
          setIsLoading(false);
        }
        return;
      }

      if (!cancelled) setIsLoading(true);
      try {
        // Use the Ref to avoid dependency on enrollmentService
        const results = await Promise.allSettled([
          enrollmentServiceRef.current.getAcademicYears(),
          enrollmentServiceRef.current.getCurrentAcademicYear(),
        ]);
        const yearsRes = results[0];
        const currentRes = results[1];
        const safeYears = yearsRes.status === 'fulfilled' && Array.isArray(yearsRes.value)
          ? yearsRes.value
          : [];
        const current = currentRes.status === 'fulfilled' ? currentRes.value : null;
        if (cancelled) return;

        // STABILIZATION CHECK: Only update if content changed
        // This prevents infinite loops if the Context Provider re-renders due to parent updates or service refetches
        setAcademicYears(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(safeYears)) {
            return safeYears;
          }
          return prev;
        });

        const storageKey = `ay:selected:${tenantId ?? 'global'}`;
        const persistedId = typeof window !== 'undefined' ? localStorage.getItem(storageKey) || undefined : undefined;

        // Determine target ID strictly
        let targetId = selectedAcademicYearId;
        // If we don't have a valid selection yet, or the current selection is invalid
        if (!targetId || !safeYears.find(y => y.id === targetId)) {
          targetId = (persistedId && safeYears.find(y => y.id === persistedId)?.id) ||
            (current && current.id) ||
            safeYears[0]?.id;
        }

        // Only update state if different
        if (targetId !== selectedAcademicYearId) {
          const name = safeYears.find(y => y.id === targetId)?.name;
          setSelectedAcademicYearIdState(targetId);
          setSelectedAcademicYearNameState(name);

          if (targetId && typeof window !== 'undefined') {
            localStorage.setItem(storageKey, targetId);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Depend strictly on Auth/Tenant state, NOT on service or calculated values.
  }, [tenantId, tenantLoading, isAuthenticated, authLoading]); // Removed conflicting dependencies

  const setId = useCallback((id?: string) => {
    const storageKey = `ay:selected:${tenantId ?? 'global'}`;
    setSelectedAcademicYearIdState(id);
    const name = academicYears.find(y => y.id === id)?.name;
    setSelectedAcademicYearNameState(name);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(storageKey, id);
      else localStorage.removeItem(storageKey);
    }
  }, [tenantId, academicYears]);

  const setName = useCallback((name?: string) => {
    setSelectedAcademicYearNameState(name);
    const id = academicYears.find(y => y.name === name)?.id;
    setSelectedAcademicYearIdState(id);
    const storageKey = `ay:selected:${tenantId ?? 'global'}`;
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(storageKey, id);
      else localStorage.removeItem(storageKey);
    }
  }, [tenantId, academicYears]);

  const value = useMemo(
    () => ({
      academicYears,
      selectedAcademicYearId,
      selectedAcademicYearName,
      isLoading,
      setSelectedAcademicYearId: setId,
      setSelectedAcademicYearName: setName,
    }),
    [academicYears, selectedAcademicYearId, selectedAcademicYearName, isLoading, setId, setName]
  );

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return ctx;
}
