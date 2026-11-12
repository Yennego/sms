'use client';

// Create a class in the current school year (grade, section, subject and its teacher), then go
// straight to its roster to enroll students.

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ClassForm, emptyClassForm, type ClassFormValues } from '@/components/classes/class-form';
import { useBuildClass } from '@/components/classes/queries-setup';
import { errorMessage } from '@/components/students/format';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { useCurrentAcademicYear } from '@/hooks/queries/enrollments';
import { useTenantNavigation } from '@/hooks/use-tenant';

export default function CreateClassPage() {
  const router = useRouter();
  const { createTenantPath } = useTenantNavigation();
  const year = useCurrentAcademicYear();
  const build = useBuildClass();
  const back = createTenantPath('/classes');

  const create = async (v: ClassFormValues) => {
    if (!year.data?.id) return;
    try {
      const created = await build.mutateAsync({
        academic_year_id: year.data.id,
        grade_id: v.grade_id,
        section_id: v.section_id,
        subject_id: v.subject_id,
        teacher_id: v.teacher_id,
        is_active: v.is_active,
        start_date: v.start_date,
        end_date: v.end_date || undefined,
        name: v.name.trim() || undefined,
        room: v.room.trim() || undefined,
        description: v.description.trim() || undefined,
        capacity: 30,
      });
      notify.success('Class created. Enroll its students next.');
      router.push(createTenantPath(`/classes/${created.id}`));
    } catch (err) {
      notify.error(errorMessage(err, "The class wasn't created. Check the details and try again."));
    }
  };

  const eyebrow = (
    <Link href={back} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
      ← Class rosters
    </Link>
  );

  return (
    <PageShell
      title="Create class"
      description="The class is created in the current school year."
      eyebrow={eyebrow}
    >
      {year.isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : year.isError ? (
        <EmptyState
          title="The school year didn't load"
          description={`${errorMessage(year.error, 'The server didn’t answer.')} Check your connection and try again.`}
          action={<Button onClick={() => year.refetch()}>Try again</Button>}
        />
      ) : !year.data?.id ? (
        <EmptyState
          title="No current school year"
          description="Make a school year current in Years and terms, then create the class."
          action={
            <Button asChild>
              <Link href={createTenantPath('/academics/academic-years')}>Open years and terms</Link>
            </Button>
          }
        />
      ) : (
        <ClassForm
          initial={emptyClassForm()}
          yearName={year.data.name}
          submitLabel="Create class"
          pending={build.isPending}
          onSubmit={create}
          onCancel={() => router.push(back)}
        />
      )}
    </PageShell>
  );
}
