'use client';

// "New announcement" (phase6-design.md section 6): pick who receives it (limited to what
// GET /announcements/audiences allows), write the title and message, then confirm who will
// receive it and send. Announcements are sent once; the server answers with the number of people
// it reached. Teachers only see their own classes.
import * as React from 'react';
import { ArrowLeft, Loader2, Search, Send, UserRound, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { inputClassName, nativeSelectClassName } from '@/components/fees/shared';
import { errorMessage } from '@/components/students/format';
import { useDebounce } from '@/hooks/use-debounce';
import {
  BODY_MAX,
  TITLE_MAX,
  type AnnouncementInput,
  type Audiences,
  type AudienceRole,
} from '@/services/api/communication-service';

import { peopleCount, ROLE_AUDIENCE_DESCRIPTIONS, ROLE_AUDIENCE_LABELS } from './format';
import { useSendAnnouncement, useStudentSearch } from './queries';

/** The audience select: "all", a role ("role:parents"), "class" or "family". */
type Choice = '' | 'all' | `role:${AudienceRole}` | 'class' | 'family';

interface PickedStudent {
  id: string;
  name: string;
  detail: string;
}

interface Draft {
  choice: Choice;
  classId: string;
  student: PickedStudent | null;
  title: string;
  body: string;
}

type Errors = Partial<Record<'choice' | 'classId' | 'student' | 'title' | 'body', string>>;

const EMPTY: Draft = { choice: '', classId: '', student: null, title: '', body: '' };

function initialDraft(audiences: Audiences): Draft {
  // Teachers have only their classes: start there; with one class, pick it
  if (audiences.roles.length === 0 && !audiences.family) {
    return { ...EMPTY, choice: 'class', classId: audiences.classes.length === 1 ? audiences.classes[0].id : '' };
  }
  return EMPTY;
}

function validate(d: Draft): Errors {
  const errors: Errors = {};
  if (!d.choice) errors.choice = 'Choose who receives it.';
  if (d.choice === 'class' && !d.classId) errors.classId = 'Choose a class.';
  if (d.choice === 'family' && !d.student) errors.student = 'Find and choose the student.';
  if (!d.title.trim()) errors.title = 'Write a title.';
  else if (d.title.trim().length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;
  if (!d.body.trim()) errors.body = 'Write the message.';
  else if (d.body.trim().length > BODY_MAX) errors.body = `Keep the message under ${BODY_MAX.toLocaleString('en-US')} characters.`;
  return errors;
}

function toInput(d: Draft): AnnouncementInput {
  const base = { title: d.title.trim(), body: d.body.trim() };
  if (d.choice === 'all') return { ...base, audience: 'all' };
  if (d.choice === 'class') return { ...base, audience: 'class', class_id: d.classId };
  if (d.choice === 'family') return { ...base, audience: 'family', student_id: d.student?.id };
  return { ...base, audience: 'role', audience_role: d.choice.slice('role:'.length) as AudienceRole };
}

/** "To" and "who that is" for the confirm step. */
function recipients(d: Draft, audiences: Audiences): { to: string; who: string } {
  if (d.choice === 'all') return { to: 'Everyone', who: 'Every active account in the school: staff, students and parents.' };
  if (d.choice === 'class') {
    const name = audiences.classes.find((c) => c.id === d.classId)?.name ?? 'the class';
    return { to: `Class ${name}`, who: `The students enrolled in ${name} and their parents.` };
  }
  if (d.choice === 'family') {
    const name = d.student?.name ?? 'the student';
    return { to: `Family of ${name}`, who: `${name} and their linked parents.` };
  }
  const role = d.choice.slice('role:'.length) as AudienceRole;
  return { to: ROLE_AUDIENCE_LABELS[role], who: ROLE_AUDIENCE_DESCRIPTIONS[role] };
}

function StudentFinder({
  value,
  onChange,
  error,
}: {
  value: PickedStudent | null;
  onChange: (s: PickedStudent | null) => void;
  error?: string;
}) {
  const [text, setText] = React.useState('');
  const q = useDebounce(text.trim(), 300);
  const results = useStudentSearch(q);
  const items = results.data?.items ?? [];

  if (value) {
    return (
      <FormField label="Student" error={error}>
        <div className="flex min-h-11 items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <UserRound className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{value.name}</p>
            {value.detail ? <p className="truncate text-xs text-muted-foreground">{value.detail}</p> : null}
          </div>
          <Button type="button" variant="ghost" className="min-h-11 md:min-h-9" onClick={() => onChange(null)}>
            <X aria-hidden="true" />
            Change
          </Button>
        </div>
      </FormField>
    );
  }

  return (
    <div className="grid gap-3">
      <FormField
        label="Find the student"
        description="Type at least two letters of the name or the admission number."
        error={error}
      >
        {(props) => (
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              {...props}
              type="search"
              autoComplete="off"
              value={text}
              maxLength={100}
              onChange={(e) => setText(e.target.value)}
              placeholder="Name or admission no."
              className={cn(inputClassName, 'pl-9')}
            />
          </div>
        )}
      </FormField>
      {q.length >= 2 ? (
        results.isLoading ? (
          <div className="grid gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : results.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(results.error, "Couldn't search students. Check your connection and try again.")}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No student matches “{q}”. Check the spelling.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border" aria-label="Matching students">
            {items.map((s) => {
              const detail = [s.admission_number, s.enrollment?.class_name].filter(Boolean).join(' · ');
              return (
                <li key={s.student_id}>
                  <button
                    type="button"
                    onClick={() => onChange({ id: s.student_id, name: s.name, detail })}
                    className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
                  >
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function NewAnnouncementSheet({
  open,
  onOpenChange,
  audiences,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audiences: Audiences;
}) {
  const send = useSendAnnouncement();
  const [draft, setDraft] = React.useState<Draft>(() => initialDraft(audiences));
  const [errors, setErrors] = React.useState<Errors>({});
  const [step, setStep] = React.useState<'write' | 'confirm'>('write');
  const [serverError, setServerError] = React.useState<string | null>(null);

  // A fresh form each time the sheet opens (not when the audiences refresh while it is open)
  const wasOpen = React.useRef(open);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(initialDraft(audiences));
      setErrors({});
      setStep('write');
      setServerError(null);
    }
    wasOpen.current = open;
  }, [open, audiences]);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key as keyof Errors];
      return next;
    });
  };

  const close = (next: boolean) => {
    if (!send.isPending) onOpenChange(next);
  };

  const onNext = () => {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setServerError(null);
      setStep('confirm');
    }
  };

  const onSend = async () => {
    setServerError(null);
    try {
      const sent = await send.mutateAsync(toInput(draft));
      if (sent.recipient_count > 0) notify.success(`Announcement sent to ${peopleCount(sent.recipient_count)}`);
      else notify.warning('Announcement saved, but no one received it: this audience has no active accounts.');
      onOpenChange(false);
    } catch (error) {
      setServerError(errorMessage(error, "The announcement wasn't sent. Check your connection and try again."));
    }
  };

  const onlyClasses = audiences.roles.length === 0 && !audiences.family;
  const summary = step === 'confirm' ? recipients(draft, audiences) : null;

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title={step === 'write' ? 'New announcement' : 'Check and send'}
      description={
        step === 'write'
          ? 'It goes to each person’s inbox, and by email to those who get emails.'
          : 'Announcements are sent once. You can withdraw one later, but emails already sent stay sent.'
      }
      footer={
        step === 'write' ? (
          <>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onNext}>
              Next
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => setStep('write')} disabled={send.isPending}>
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <Button type="button" onClick={() => void onSend()} disabled={send.isPending}>
              {send.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              Send announcement
            </Button>
          </>
        )
      }
    >
      {step === 'write' ? (
        <form
          className="grid gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onNext();
          }}
        >
          {onlyClasses ? null : (
            <FormField label="Send to" error={errors.choice} required>
              <select
                className={nativeSelectClassName}
                value={draft.choice}
                onChange={(e) => update({ choice: e.target.value as Choice })}
              >
                <option value="">Choose who receives it</option>
                {audiences.roles.length > 0 ? <option value="all">Everyone</option> : null}
                {audiences.roles.map((r) => (
                  <option key={r} value={`role:${r}`}>
                    {ROLE_AUDIENCE_LABELS[r] ?? r}
                  </option>
                ))}
                {audiences.classes.length > 0 ? <option value="class">One class (students and parents)</option> : null}
                {audiences.family ? <option value="family">One family (a student and their parents)</option> : null}
              </select>
            </FormField>
          )}

          {draft.choice === 'class' ? (
            <FormField
              label={onlyClasses ? 'Send to class' : 'Class'}
              description={onlyClasses ? 'The students of the class and their parents.' : undefined}
              error={errors.classId}
              required
            >
              <select
                className={nativeSelectClassName}
                value={draft.classId}
                onChange={(e) => update({ classId: e.target.value })}
              >
                <option value="">Choose a class</option>
                {audiences.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}

          {draft.choice === 'family' ? (
            <StudentFinder value={draft.student} onChange={(student) => update({ student })} error={errors.student} />
          ) : null}

          <FormField label="Title" error={errors.title} required>
            <Input
              value={draft.title}
              maxLength={TITLE_MAX}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="e.g. School closed on Friday"
              className={inputClassName}
            />
          </FormField>

          <FormField
            label="Message"
            error={errors.body}
            description={`${draft.body.length.toLocaleString('en-US')} of ${BODY_MAX.toLocaleString('en-US')} characters`}
            required
          >
            <Textarea
              value={draft.body}
              rows={7}
              maxLength={BODY_MAX}
              onChange={(e) => update({ body: e.target.value })}
              className="text-base md:text-sm"
            />
          </FormField>
          {/* Enter in the title moves on, like the Next button */}
          <button type="submit" className="sr-only" tabIndex={-1}>
            Next
          </button>
        </form>
      ) : summary ? (
        <div className="grid gap-4">
          <dl className="grid gap-3 rounded-xl border bg-muted/30 p-4">
            <div>
              <dt className="text-sm text-muted-foreground">To</dt>
              <dd className="text-base font-semibold text-foreground">{summary.to}</dd>
              <dd className="text-sm text-muted-foreground">{summary.who}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Title</dt>
              <dd className="text-base font-medium break-words text-foreground">{draft.title.trim()}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Message</dt>
              <dd className="text-sm break-words whitespace-pre-line text-foreground">{draft.body.trim()}</dd>
            </div>
          </dl>
          {serverError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {serverError}
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
