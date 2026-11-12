'use client';

// Edit a class: grade and section, subject and its teacher, dates, name, room and whether it is active.

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { School } from 'lucide-react';

import { ClassForm, type ClassFormValues } from '@/components/classes/class-form';
import { errorMessage, isNotFound } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/components/ui/toaster';
import { useClass, useUpdateClass } from '@/hooks/queries/classes';
import { useTenantNavigation } from '@/hooks/use-tenant';

export default function EditClassPage() {
  const router = useRouter();
  const { id: classId } = useParams<{ id: string }>();
  const { createTenantPath } = useTenantNavigation();
  const cls = useClass(classId);
  const update = useUpdateClass();
  const classPath = createTenantPath(`/classes/${classId}`);

  const save = async (v: ClassFormValues) => {
    try {
      await update.mutateAsync({
        id: classId,
        data: {
          name: v.name.trim(),
          academic_year_id: cls.data?.academic_year_id,
          description: v.description,
          room: v.room,
          is_active: v.is_active,
          start_date: v.start_date,
          end_date: v.end_date,
          grade_id: v.grade_id,
          section_id: v.section_id,
          subject_id: v.subject_id,
          teacher_id: v.teacher_id,
        },
      });
      notify.success('Class saved.');
      router.push(classPath);
    } catch (err) {
      notify.error(errorMessage(err, "The class wasn't saved. Check the details and try again."));
    }
  };

  const eyebrow = (
    <Link href={classPath} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
      ← Back to the class
    </Link>
  );

  if (cls.isLoading) {
    return (
      <PageShell title="Edit class" eyebrow={eyebrow}>
        <Skeleton className="h-96 w-full rounded-xl" />
      </PageShell>
    );
  }

  if (cls.isError || !cls.data) {
    return (
      <PageShell title="Edit class" eyebrow={eyebrow}>
        {isNotFound(cls.error) ? (
          <EmptyState
            icon={School}
            title="Class not found"
            description="It may have been deleted. Go back to the class rosters and pick another class."
            action={
              <Button asChild>
                <Link href={createTenantPath('/classes')}>Open class rosters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={School}
            title="The class didn't load"
            description={`${errorMessage(cls.error, 'The server didn’t answer.')} Check your connection and try again.`}
            action={<Button onClick={() => cls.refetch()}>Try again</Button>}
          />
        )}
      </PageShell>
    );
  }

  const c = cls.data;
  return (
    <PageShell title="Edit class" description={c.name || undefined} eyebrow={eyebrow}>
      <ClassForm
        key={c.id}
        initial={{
          name: c.name || '',
          grade_id: c.grade_id || '',
          section_id: c.section_id || '',
          subject_id: c.subject_id || '',
          teacher_id: c.teacher_id || '',
          start_date: (c.start_date || '').slice(0, 10),
          end_date: (c.end_date || '').slice(0, 10),
          room: c.room || '',
          description: c.description || '',
          is_active: Boolean(c.is_active),
        }}
        yearName={c.academic_year_name || ''}
        requireName
        activeOnly
        submitLabel="Save class"
        pending={update.isPending}
        onSubmit={save}
        onCancel={() => router.push(classPath)}
      />
    </PageShell>
  );
}
