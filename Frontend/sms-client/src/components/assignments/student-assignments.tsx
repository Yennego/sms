'use client';

// The student's assignments (phone first): work still to hand in, then work handed in with any
// mark and comment from the teacher.

import * as React from 'react';
import { CheckCircle2, FileText, MessageSquare, Send } from 'lucide-react';

import { isMarked, WorkBadge } from '@/components/assignments/assignment-ui';
import { useAssignmentList, useAssignmentSubjects, useMySubmissions } from '@/components/assignments/queries';
import { SubmitWorkDialog } from '@/components/assignments/submit-work-dialog';
import { selectClass } from '@/components/students/admission-form';
import { errorMessage, formatDate, isoDay } from '@/components/students/format';
import { useMyEnrollment } from '@/components/teaching/queries';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { Assignment } from '@/services/api/assignment-service';
import type { Submission } from '@/services/api/submission-service';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function AssignmentCard({
  assignment: a,
  subject,
  submission,
  today,
  onHandIn,
}: {
  assignment: Assignment;
  subject: string;
  submission?: Submission;
  today: string;
  onHandIn: () => void;
}) {
  const marked = isMarked(submission);
  return (
    <li className="space-y-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{a.title}</p>
            <p className="text-sm text-muted-foreground">
              {[subject, `due ${formatDate(a.due_date)}`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <WorkBadge submission={submission} due={a.due_date} today={today} />
      </div>
      {marked ? (
        <div className="ml-8 space-y-2">
          <p className="text-sm">
            Mark:{' '}
            <span className="font-semibold tabular-nums">
              {submission?.score ?? '–'} / {a.max_score}
            </span>
          </p>
          {submission?.feedback ? (
            <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="whitespace-pre-wrap">
                <span className="sr-only">Teacher&apos;s comment: </span>
                {submission.feedback}
              </span>
            </p>
          ) : null}
        </div>
      ) : !submission ? (
        <div className="ml-8">
          <Button size="sm" className="min-h-11 md:min-h-9" onClick={onHandIn}>
            <Send aria-hidden="true" />
            Hand in work
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function StudentAssignments({ studentId }: { studentId: string }) {
  const [subjectId, setSubjectId] = React.useState('');
  const [handingIn, setHandingIn] = React.useState<Assignment | null>(null);

  const enrollment = useMyEnrollment(studentId);
  const subjects = useAssignmentSubjects();
  const list = useAssignmentList(
    { subjectId, teacherId: '', gradeId: '', sectionId: '' },
    enrollment.data
  );
  const submissions = useMySubmissions(true);

  const today = isoDay(new Date());
  const subjectName = (a: Assignment) => a.subject_name || subjects.data?.find((s) => s.id === a.subject_id)?.name || '';
  const byAssignment = new Map((submissions.data ?? []).map((s) => [s.assignment_id, s]));
  const all = enrollment.data ? list.data ?? [] : [];
  const toDo = all.filter((a) => !byAssignment.has(a.id)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const done = all.filter((a) => byAssignment.has(a.id)).sort((a, b) => b.due_date.localeCompare(a.due_date));

  const loading = enrollment.isLoading || (Boolean(enrollment.data) && (list.isLoading || submissions.isLoading));
  const failed = list.isError || submissions.isError;

  const card = (a: Assignment) => (
    <AssignmentCard
      key={a.id}
      assignment={a}
      subject={subjectName(a)}
      submission={byAssignment.get(a.id)}
      today={today}
      onHandIn={() => setHandingIn(a)}
    />
  );

  return (
    <>
      <div className="grid max-w-xs gap-2">
        <label htmlFor="as-subject" className="text-sm font-medium">
          Subject
        </label>
        <select id="as-subject" className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">All subjects</option>
          {(subjects.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : failed ? (
        <EmptyState
          icon={FileText}
          description={`${errorMessage(list.error ?? submissions.error, "Your assignments didn't load.")} Check your connection and try again.`}
          action={
            <Button
              variant="outline"
              onClick={() => {
                void list.refetch();
                void submissions.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      ) : !enrollment.data ? (
        <EmptyState icon={FileText} description="You aren't in a class this year yet. Ask the school office to enroll you." />
      ) : all.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          description={subjectId ? 'No assignments for this subject yet.' : "Your teachers haven't set any assignments yet."}
        />
      ) : (
        <>
          <Section title="To hand in">
            {toDo.length === 0 ? (
              <EmptyState icon={CheckCircle2} description="Nothing to hand in. You're all caught up." />
            ) : (
              <ul className="divide-y rounded-xl border bg-card">{toDo.map(card)}</ul>
            )}
          </Section>
          {done.length > 0 ? (
            <Section title="Handed in">
              <ul className="divide-y rounded-xl border bg-card">{done.map(card)}</ul>
            </Section>
          ) : null}
        </>
      )}

      {handingIn ? <SubmitWorkDialog assignment={handingIn} onClose={() => setHandingIn(null)} /> : null}
    </>
  );
}
