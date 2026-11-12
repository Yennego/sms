'use client';

// The student's courses (phone first): the subjects of their class and who teaches each one.

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Award, BookOpen, GraduationCap, User } from 'lucide-react';

import { enrollmentLabel, useMyCourses, useMyEnrollment } from '@/components/teaching/queries';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

export default function StudentCoursesPage() {
  const { tenantDomain } = useParams<{ tenantDomain: string }>();
  const { user } = useAuth();
  const enrollment = useMyEnrollment(user?.id ?? '');
  const courses = useMyCourses(enrollment.data);

  const className = enrollmentLabel(enrollment.data);
  const loading = !user?.id || enrollment.isLoading || (Boolean(enrollment.data) && courses.isLoading);
  const failed = enrollment.isError || courses.isError;
  const list = courses.data ?? [];

  return (
    <PageShell
      title="My courses"
      description={className ? `Your subjects in ${className}.` : 'Your subjects this school year.'}
      primaryAction={
        <Button asChild className="min-h-11 md:min-h-9">
          <Link href={`/${tenantDomain}/student/grades`}>
            <Award aria-hidden="true" />
            See my results
          </Link>
        </Button>
      }
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState
          icon={BookOpen}
          description={`${errorMessage(enrollment.error ?? courses.error, "Your courses didn't load.")} Check your connection and try again.`}
          action={
            <Button
              variant="outline"
              onClick={() => {
                void enrollment.refetch();
                void courses.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      ) : !enrollment.data ? (
        <EmptyState icon={GraduationCap} description="You aren't in a class this year yet. Ask the school office to enroll you." />
      ) : list.length === 0 ? (
        <EmptyState icon={BookOpen} description="Your class has no subjects yet. Check again later." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Courses">
          {list.map((c) => (
            <li key={c.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <BookOpen className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">{c.subject}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="size-4 shrink-0" aria-hidden="true" />
                  {c.teacher ? `Teacher: ${c.teacher}` : 'No teacher yet'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
