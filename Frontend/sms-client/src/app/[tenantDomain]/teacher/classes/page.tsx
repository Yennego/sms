'use client';

// The teacher's classes (phone first): one card per subject they teach in a class, the class's
// students, and the way to mark attendance in the classes they sponsor.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BookOpen, ClipboardCheck, Search, Users } from 'lucide-react';

import { useAttendanceClasses } from '@/components/attendance/queries';
import { useLoadStudents, useTeacherLoads, type SubjectLoad } from '@/components/teaching/queries';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useTenantFeatures } from '@/hooks/use-tenant-features';

function AttendanceLink({ href, primary }: { href: string; primary?: boolean }) {
  return (
    <Button asChild size="sm" variant={primary ? 'default' : 'outline'} className="min-h-11 md:min-h-9">
      <Link href={href}>
        <ClipboardCheck aria-hidden="true" />
        Mark attendance
      </Link>
    </Button>
  );
}

/** The students of one subject load. */
function Roster({ load }: { load: SubjectLoad }) {
  const students = useLoadStudents(load.id);
  if (students.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (students.isError) {
    return (
      <EmptyState
        bare
        icon={Users}
        description={`${errorMessage(students.error, "The students didn't load.")} Check your connection and try again.`}
        action={
          <Button variant="outline" onClick={() => void students.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  const list = students.data ?? [];
  if (list.length === 0) {
    return <EmptyState bare icon={Users} description="No students are enrolled in this class yet." />;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {list.length} {list.length === 1 ? 'student' : 'students'}
      </p>
      <ol className="divide-y rounded-xl border">
        {list.map((s, i) => (
          <li key={s.id || i} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{s.name}</p>
              {s.admissionNo ? <p className="text-sm text-muted-foreground">{s.admissionNo}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function TeacherClassesPage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { user } = useAuth();
  const features = useTenantFeatures();
  const attendanceOn = !features.isLoading && features.isFeatureEnabled('enable_attendance');

  const loads = useTeacherLoads(user?.id ?? '');
  // Only a class's sponsor marks its daily attendance
  const sponsored = useAttendanceClasses(user?.id, Boolean(user?.id) && attendanceOn);
  const sponsoredIds = React.useMemo(() => new Set((sponsored.data ?? []).map((c) => c.id)), [sponsored.data]);

  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState<SubjectLoad | null>(null);

  const all = loads.data ?? [];
  const query = search.trim().toLowerCase();
  const shown = query ? all.filter((l) => `${l.subject} ${l.className}`.toLowerCase().includes(query)) : all;
  const attendanceHref = (classId: string) => `/${tenantDomain}/teacher/attendance?classId=${classId}`;
  const canMark = (load: SubjectLoad) => attendanceOn && sponsoredIds.has(load.classId);

  return (
    <PageShell title="My classes" description="The subjects you teach, class by class.">
      {all.length > 0 ? (
        <div className="relative max-w-md">
          <label htmlFor="class-search" className="sr-only">
            Search your classes
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="class-search"
            type="search"
            className="h-11 pl-9 text-base md:h-9 md:text-sm"
            placeholder="Search by subject or class"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      ) : null}

      {!user?.id || loads.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : loads.isError ? (
        <EmptyState
          icon={BookOpen}
          description={`${errorMessage(loads.error, "Your classes didn't load.")} Check your connection and try again.`}
          action={
            <Button variant="outline" onClick={() => void loads.refetch()}>
              Try again
            </Button>
          }
        />
      ) : all.length === 0 ? (
        <EmptyState icon={BookOpen} description="You don't teach any subjects yet. The school office assigns them." />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Search}
          description="No classes match your search."
          action={
            <Button variant="outline" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="My classes">
          {shown.map((load) => (
            <li key={load.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <p className="font-medium">{load.subject}</p>
                <p className="text-sm text-muted-foreground">{load.className}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="min-h-11 md:min-h-9" onClick={() => setOpen(load)}>
                  <Users aria-hidden="true" />
                  See students
                </Button>
                {canMark(load) ? <AttendanceLink href={attendanceHref(load.classId)} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `${open.subject}, ${open.className}` : 'Students'}
        description="The students in this class."
        footer={
          open ? (
            <>
              <Button variant="outline" onClick={() => setOpen(null)}>
                Close
              </Button>
              {canMark(open) ? <AttendanceLink href={attendanceHref(open.classId)} primary /> : null}
            </>
          ) : null
        }
      >
        {open ? <Roster load={open} /> : null}
      </Sheet>
    </PageShell>
  );
}
