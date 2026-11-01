'use client';

// Graduation: students in the final grade level leave the school as graduates. The server
// decides who is a candidate; graduating asks first and can't be undone from here.
import { useEffect, useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import PermissionGuard from '@/components/auth/permission-guard';
import { useEnrollmentService, type GraduationCandidates } from '@/services/api/enrollment-service';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { notify } from '@/components/ui/toaster';

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  Eligible: 'success', Repeating: 'danger', Conditional: 'warning',
};

export default function GraduationPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const enrollmentService = useEnrollmentService();
  const [yearId, setYearId] = useState<string | null>(null);
  const [data, setData] = useState<GraduationCandidates | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (tenantLoading || !tenant?.id) return;
      setLoading(true);
      try {
        const currentYear = await enrollmentService.getCurrentAcademicYear();
        if (!currentYear?.id) return;
        setYearId(currentYear.id);
        const result = await enrollmentService.getGraduationCandidates(currentYear.id);
        setData(result);
        // Preselect only students the promotion evaluation found eligible
        setSelected(new Set(result.candidates.filter((c) => c.promotion_status === 'Eligible').map((c) => c.student_id)));
      } catch (err) {
        console.error(err);
        notify.error('The graduation list could not be loaded. Try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per school
  }, [tenantLoading, tenant?.id]);

  const candidates = useMemo(() => data?.candidates ?? [], [data]);
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const graduate = async () => {
    if (!yearId) return;
    const result = await enrollmentService.graduateStudents(yearId, [...selected]);
    notify.success(`${result.graduated} student${result.graduated === 1 ? '' : 's'} graduated`);
    setData((prev) => prev && { ...prev, candidates: prev.candidates.filter((c) => !selected.has(c.student_id)) });
    setSelected(new Set());
  };

  return (
    <PermissionGuard requiredRole="admin" fallback={<div>Your role can&apos;t do this. Ask your school administrator.</div>}>
      <PageShell
        title="Graduation"
        description={data?.final_grade
          ? `Students in ${data.final_grade.name}, the final grade level, this school year.`
          : 'Students in the final grade level this school year.'}
        primaryAction={candidates.length > 0 ? (
          <Button onClick={() => setConfirming(true)} disabled={selected.size === 0}>
            Graduate {selected.size} student{selected.size === 1 ? '' : 's'}
          </Button>
        ) : undefined}
      >
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">Loading the graduation list…</p>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            description={data?.final_grade
              ? `No active students in ${data.final_grade.name} this school year.`
              : 'Set up grade levels and a current school year to see graduation candidates.'}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3 w-10"><span className="sr-only">Graduate</span></th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Admission no.</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Promotion result</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.enrollment_id} className="border-b last:border-0">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        aria-label={`Graduate ${c.name}`}
                        checked={selected.has(c.student_id)}
                        onChange={() => toggle(c.student_id)}
                      />
                    </td>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3">{c.admission_number}</td>
                    <td className="p-3">{c.class_name ?? '—'}</td>
                    <td className="p-3">
                      {c.promotion_status
                        ? <StatusBadge status={STATUS_VARIANT[c.promotion_status] ?? 'neutral'} label={c.promotion_status} />
                        : <span className="text-muted-foreground">Not evaluated yet</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageShell>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Graduate ${selected.size} student${selected.size === 1 ? '' : 's'}?`}
        description="They leave the school as graduates: their enrollment ends and their status becomes graduated."
        confirmLabel="Graduate students"
        destructive
        onConfirm={graduate}
      />
    </PermissionGuard>
  );
}
