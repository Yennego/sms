'use client';

import React, { useEffect, useState } from 'react';
import PermissionGuard from '@/components/auth/permission-guard';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function GraduationPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const enrollmentService = useEnrollmentService();
  const [candidates, setCandidates] = useState<{ student_id: string; enrollment_id: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCandidates = async () => {
      if (tenantLoading || !tenant?.id) return;
      setLoading(true);
      try {
        const currentYear = await enrollmentService.getCurrentAcademicYear();
        if (!currentYear?.name) return;
        const list = await enrollmentService.getGraduationCandidates(currentYear.name);
        setCandidates(list);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load graduation candidates');
      } finally {
        setLoading(false);
      }
    };
    loadCandidates();
  }, [tenantLoading, tenant?.id]);

  const graduateAll = async () => {
    try {
      const currentYear = await enrollmentService.getCurrentAcademicYear();
      if (!currentYear?.id) return;
      await enrollmentService.graduateStudents(currentYear.id, candidates.map(c => c.student_id));
      toast.success('Graduation processed');
      setCandidates([]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to graduate students');
    }
  };

  return (
    <PermissionGuard requiredRole="admin" fallback={<div>Access denied</div>}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Graduation Candidates</h1>
        {loading ? (
          <div>Loading...</div>
        ) : candidates.length === 0 ? (
          <div className="text-sm text-muted-foreground">No candidates found.</div>
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={graduateAll}>Graduate All</Button>
            </div>
            <div className="rounded-md border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Student ID</th>
                    <th className="p-2">Enrollment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(c => (
                    <tr key={`${c.student_id}-${c.enrollment_id}`} className="border-b">
                      <td className="p-2 font-mono text-xs">{c.student_id}</td>
                      <td className="p-2 font-mono text-xs">{c.enrollment_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PermissionGuard>
  );
}