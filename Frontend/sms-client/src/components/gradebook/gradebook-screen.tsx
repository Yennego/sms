'use client';

// Gradebook (phase4-design.md section 5): pick class → subject → period (or semester exam),
// then enter marks. Desk: a grid of students × assessments. Phone: one assessment at a time.
// Picks live in the URL so reload and shared links open the same sheet. Unsaved marks are kept
// in the browser until "Save scores" sends each changed column (PUT .../scores, all or nothing
// per column); the sheet is then refetched because the server computes period scores.
import * as React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarRange,
  ClipboardList,
  Eye,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  School,
  Trash2,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageShell } from '@/components/ui/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import { useUrlState } from '@/components/class-placement/use-url-state';
import {
  errorStatus,
  errorText,
  KIND_LABELS,
  scoreProblems,
  type GradebookClassSubject,
  type GradebookSheet,
  type SheetAssessment,
  type SheetTarget,
} from '@/services/api/gradebook-service';
import { AssessmentSheet } from './assessment-sheet';
import { CommentSheet, type CommentTarget } from './comment-sheet';
import { GradebookPickers, selectClass, type ClassOption } from './gradebook-pickers';
import {
  changedCells,
  currentTerm,
  draftError,
  draftToEntry,
  entryToDraft,
  formatNumber,
  savedDraft,
  termOptions,
  withDraft,
  type DraftEntry,
  type Drafts,
  type TermOption,
} from './gradebook-utils';
import {
  classLabel,
  subjectLabel,
  useClassSubjects,
  useCurrentYear,
  useDeleteAssessment,
  useRefreshSheets,
  useSaveScores,
  useSheet,
  useTerms,
} from './queries';
import type { UpdateCell } from './score-cell';
import { ScoreGrid, type SavedCells } from './score-grid';
import { ScoreList } from './score-list';
import { useMediaQuery, useUnsavedGuard } from './use-unsaved-guard';

const URL_DEFAULTS = { class: '', subject: '', period: '', exam: '', assessment: '' };

const FORBIDDEN_MESSAGE = "Your role can't change these marks.";
const PUBLISHED_MESSAGE = 'Results for this period are published. Ask the principal to unpublish them first.';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function GradebookScreen() {
  const [url, setUrl] = useUrlState(URL_DEFAULTS);
  const isDesk = useMediaQuery('(min-width: 768px)');

  // ---- pickers ----
  const year = useCurrentYear();
  const yearId = year.data?.id;
  const terms = useTerms(yearId);
  const options = React.useMemo(() => termOptions(terms.data), [terms.data]);

  // The server lists exactly the class subjects this user may view.
  const classSubjects = useClassSubjects(yearId);
  const allSubjects = React.useMemo(() => classSubjects.data ?? [], [classSubjects.data]);
  const classes: ClassOption[] = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of allSubjects) if (!seen.has(s.class_id)) seen.set(s.class_id, classLabel(s));
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [allSubjects]);
  const classesLoading = year.isLoading || classSubjects.isLoading;
  const showTeacher = new Set(allSubjects.map((s) => s.teacher_id ?? '')).size > 1;

  const classId = classes.some((c) => c.id === url.class)
    ? url.class
    : classes.length === 1
      ? classes[0].id
      : classesLoading
        ? url.class
        : '';

  const subjects: GradebookClassSubject[] = React.useMemo(
    () => allSubjects.filter((s) => s.class_id === classId),
    [allSubjects, classId]
  );
  const subjectsLoading = classesLoading;

  const classSubjectId = subjects.some((s) => s.class_subject_id === url.subject)
    ? url.subject
    : subjects.length === 1
      ? subjects[0].class_subject_id
      : subjectsLoading
        ? url.subject
        : '';
  const classSubject = subjects.find((s) => s.class_subject_id === classSubjectId);

  const term: TermOption | undefined = React.useMemo(() => {
    if (url.exam) {
      const exam = options.find((o) => o.type === 'exam' && o.id === url.exam);
      if (exam) return exam;
    }
    if (url.period) {
      const period = options.find((o) => o.type === 'period' && o.id === url.period);
      if (period) return period;
    }
    return currentTerm(options);
  }, [options, url.exam, url.period]);
  const isExam = term?.type === 'exam';

  const target: SheetTarget | null = React.useMemo(() => {
    if (!classSubjectId || !term) return null;
    return term.type === 'exam'
      ? { classSubjectId, semesterId: term.id }
      : { classSubjectId, periodId: term.id };
  }, [classSubjectId, term]);
  const targetKey = target ? JSON.stringify(target) : '';

  // ---- the sheet ----
  const sheetQuery = useSheet(target);
  const sheet: GradebookSheet | undefined = sheetQuery.data;
  const refreshSheets = useRefreshSheets();

  const saved: SavedCells = React.useMemo(() => {
    const map: SavedCells = new Map();
    if (!sheet) return map;
    for (const a of sheet.assessments) {
      const column = new Map<string, DraftEntry>();
      for (const s of sheet.students) column.set(s.student_id, entryToDraft(s.scores?.[a.id]));
      map.set(a.id, column);
    }
    return map;
  }, [sheet]);

  // ---- unsaved marks (belong to one sheet; switching sheets starts clean) ----
  const [draftState, setDraftState] = React.useState<{ key: string; drafts: Drafts }>({ key: '', drafts: {} });
  const drafts = React.useMemo<Drafts>(
    () => (draftState.key === targetKey ? draftState.drafts : {}),
    [draftState, targetKey]
  );
  const latest = React.useRef({ sheet, targetKey, drafts });
  React.useEffect(() => {
    latest.current = { sheet, targetKey, drafts };
  }, [sheet, targetKey, drafts]);

  const onUpdate: UpdateCell = React.useCallback((assessmentId, studentId, update) => {
    setDraftState((prev) => {
      const { sheet: current, targetKey: key } = latest.current;
      if (!current) return prev;
      const base = prev.key === key ? prev.drafts : {};
      const value = base[assessmentId]?.[studentId] ?? savedDraft(current, assessmentId, studentId);
      return { key, drafts: withDraft(current, base, assessmentId, studentId, update(value)) };
    });
  }, []);

  const changes = React.useMemo(() => changedCells(sheet, drafts), [sheet, drafts]);
  const invalid = changes.filter((c) => draftError(c.draft, c.assessment.max_score));
  const dirty = changes.length > 0;

  // ---- who may edit ----
  const [forbiddenFor, setForbiddenFor] = React.useState<string | null>(null);
  const published = sheet?.published ?? false;
  // Holds manage_academic_data: may correct published results.
  const correctsPublished = sheet?.can_manage ?? false;
  // A viewer (sponsor of a class, or staff who only view): never edits this subject.
  const viewerOnly = classSubject ? !classSubject.can_edit : sheet ? !sheet.can_edit && !published : false;
  const readOnly = !sheet?.can_edit || forbiddenFor === classSubjectId;

  // ---- leaving with unsaved marks ----
  const guard = useUnsavedGuard(dirty);
  const [pendingPick, setPendingPick] = React.useState<(() => void) | null>(null);
  const pick = (apply: () => void) => {
    if (dirty) setPendingPick(() => apply);
    else apply();
  };

  // ---- saving ----
  const saveScores = useSaveScores();
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (!sheet || saving || !dirty) return;
    if (invalid.length) {
      notify.error(`Fix ${plural(invalid.length, 'mark', 'marks')} before saving`, {
        description: 'Each mark must be a number from 0 to the highest possible score. Marked cells show the problem.',
      });
      return;
    }
    const columns = new Map<string, { assessment: SheetAssessment; cells: typeof changes }>();
    for (const c of changes) {
      const col = columns.get(c.assessment.id) ?? { assessment: c.assessment, cells: [] };
      col.cells.push(c);
      columns.set(c.assessment.id, col);
    }
    setSaving(true);
    let savedCount = 0;
    const problems: string[] = [];
    let stopped = false;
    for (const { assessment, cells } of columns.values()) {
      try {
        await saveScores.mutateAsync({
          assessmentId: assessment.id,
          entries: cells.map((c) => draftToEntry(c.studentId, c.draft)),
        });
        savedCount += cells.length;
        // Drop the saved drafts (unless typed over while saving).
        setDraftState((prev) => {
          if (prev.key !== targetKey) return prev;
          const column = { ...(prev.drafts[assessment.id] ?? {}) };
          for (const c of cells) if (column[c.studentId] === c.draft) delete column[c.studentId];
          const next = { ...prev.drafts };
          if (Object.keys(column).length) next[assessment.id] = column;
          else delete next[assessment.id];
          return { key: prev.key, drafts: next };
        });
      } catch (error) {
        const status = errorStatus(error);
        if (status === 403) {
          setForbiddenFor(classSubjectId);
          notify.error(FORBIDDEN_MESSAGE, { description: 'Nothing more was saved. Ask an administrator if this is wrong.' });
          stopped = true;
          break;
        }
        if (status === 409) {
          notify.error(errorText(error, PUBLISHED_MESSAGE));
          stopped = true;
          break;
        }
        const perStudent = scoreProblems(error)
          .map((p) => `${sheet.students.find((st) => st.student_id === p.student_id)?.name ?? 'A student'}: ${p.error}`)
          .join('; ');
        problems.push(
          `${assessment.title}: ${perStudent || errorText(error, "the marks couldn't be saved. Check them and try again.")}`
        );
      }
    }
    await refreshSheets();
    setSaving(false);
    if (problems.length) {
      notify.error(
        problems.length === 1 ? 'One column was not saved' : `${problems.length} columns were not saved`,
        { description: problems.join(' ') + ' Your changes in those columns are still here.' }
      );
    }
    if (savedCount && !stopped && !problems.length) {
      notify.success(`${plural(savedCount, 'mark', 'marks')} saved`, {
        description: isExam ? undefined : 'Period scores are updated.',
      });
    } else if (savedCount) {
      notify.info(`${plural(savedCount, 'mark', 'marks')} saved`);
    }
  };

  // Ctrl/Cmd+S saves on desk.
  const saveRef = React.useRef(save);
  React.useEffect(() => {
    saveRef.current = save;
  });
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- assessments ----
  const [editing, setEditing] = React.useState<{ assessment: SheetAssessment | null } | null>(null);
  const [deleting, setDeleting] = React.useState<SheetAssessment | null>(null);
  const deleteAssessment = useDeleteAssessment();
  const examExists = isExam && (sheet?.assessments.some((a) => a.kind === 'exam') ?? false);
  const canManage = Boolean(sheet) && !readOnly;

  const onEditAssessment = React.useCallback((a: SheetAssessment) => setEditing({ assessment: a }), []);
  const onDeleteAssessment = React.useCallback((a: SheetAssessment) => setDeleting(a), []);

  const deletingEntered = deleting && sheet ? sheet.students.filter((s) => s.scores?.[deleting.id]).length : 0;

  const onUpdateColumnCleared = (assessmentId: string) =>
    setDraftState((prev) => {
      if (!prev.drafts[assessmentId]) return prev;
      const next = { ...prev.drafts };
      delete next[assessmentId];
      return { key: prev.key, drafts: next };
    });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteAssessment.mutateAsync({ id: deleting.id, force: deletingEntered > 0 && Boolean(sheet?.can_edit) });
      onUpdateColumnCleared(deleting.id);
      notify.success(`${deleting.title} deleted`);
    } catch (error) {
      const status = errorStatus(error);
      notify.error(
        status === 403
          ? FORBIDDEN_MESSAGE
          : errorText(error, "We couldn't delete this assessment. Try again.")
      );
    }
  };


  // ---- comments ----
  const [comment, setComment] = React.useState<CommentTarget | null>(null);
  const onComment = React.useCallback((assessmentId: string, studentId: string) => {
    const current = latest.current.sheet;
    if (!current) return;
    const student = current.students.find((s) => s.student_id === studentId);
    const assessment = current.assessments.find((a) => a.id === assessmentId);
    if (!student || !assessment) return;
    const value = latest.current.drafts[assessmentId]?.[studentId] ?? savedDraft(current, assessmentId, studentId);
    setComment({
      assessmentId,
      studentId,
      studentName: student.name,
      assessmentTitle: assessment.title,
      comment: value.comment,
    });
  }, []);

  // ---- phone: one assessment at a time ----
  const phoneAssessment =
    sheet?.assessments.find((a) => a.id === url.assessment) ?? sheet?.assessments[0] ?? null;

  // ---- render helpers ----
  const addButton = (full = false) =>
    canManage && term ? (
      <Button
        type="button"
        variant={sheet && sheet.assessments.length === 0 ? 'default' : 'outline'}
        onClick={() => setEditing({ assessment: null })}
        disabled={examExists || saving}
        title={examExists ? "This semester's exam is already added." : undefined}
        className={full ? 'min-h-11 w-full' : undefined}
      >
        <Plus aria-hidden="true" />
        {isExam ? 'Add the exam' : 'Add assessment'}
      </Button>
    ) : null;

  const saveButton = (
    <Button
      type="button"
      onClick={() => void save()}
      disabled={!dirty || saving || readOnly}
      className="hidden md:inline-flex"
    >
      {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
      Save scores
      {dirty ? ` (${changes.length})` : ''}
    </Button>
  );

  const description =
    'Enter and review marks by class, subject and period. Period scores are worked out after you save.';

  let body: React.ReactNode;
  if (year.isLoading || (yearId && terms.isLoading)) {
    body = <Skeleton className="h-64 w-full" />;
  } else if (year.isError) {
    body = (
      <EmptyState
        icon={AlertTriangle}
        title="The school year didn't load"
        description={errorText(year.error, 'Check your connection and try again.')}
        action={
          <Button variant="outline" onClick={() => void year.refetch()}>
            <RefreshCw aria-hidden="true" /> Try again
          </Button>
        }
      />
    );
  } else if (!yearId) {
    body = (
      <EmptyState
        icon={CalendarRange}
        title="No current school year"
        description="Set the current school year in Year setup, then come back to enter marks."
      />
    );
  } else if (options.length === 0) {
    body = (
      <EmptyState
        icon={CalendarRange}
        title="This year has no periods yet"
        description="Add the semesters and periods of this year in Year setup first."
      />
    );
  } else if (!classesLoading && classes.length === 0) {
    body = (
      <EmptyState
        icon={BookOpen}
        title="No class subjects to show"
        description="Teachers see the subjects they teach and the classes they sponsor. Ask the school office to assign you if one is missing."
      />
    );
  } else if (!classId) {
    body = <EmptyState icon={School} title="Choose a class" description="Pick a class above to see its subjects and marks." />;
  } else if (!subjectsLoading && subjects.length === 0) {
    body = (
      <EmptyState
        icon={BookOpen}
        title="This class has no subjects yet"
        description="Add subjects to the class (with their teachers) before entering marks."
      />
    );
  } else if (!classSubjectId) {
    body = subjectsLoading ? (
      <Skeleton className="h-64 w-full" />
    ) : (
      <EmptyState icon={BookOpen} title="Choose a subject" description="Pick a subject above to open its marks." />
    );
  } else if (sheetQuery.isLoading) {
    body = <Skeleton className="h-64 w-full" />;
  } else if (sheetQuery.isError || !sheet) {
    const status = errorStatus(sheetQuery.error);
    body = (
      <EmptyState
        icon={status === 403 ? Lock : AlertTriangle}
        title={status === 403 ? "You can't see these marks" : "The marks didn't load"}
        description={
          status === 403
            ? 'Only the subject teacher, the class sponsor and academic staff can see these marks.'
            : errorText(sheetQuery.error, 'Check your connection and try again.')
        }
        action={
          status === 403 ? undefined : (
            <Button variant="outline" onClick={() => void sheetQuery.refetch()}>
              <RefreshCw aria-hidden="true" /> Try again
            </Button>
          )
        }
      />
    );
  } else if (sheet.students.length === 0) {
    body = (
      <EmptyState
        icon={Users}
        title="No students in this class"
        description="Place students in this class first. Their marks can be entered here after that."
      />
    );
  } else if (sheet.assessments.length === 0) {
    body = (
      <EmptyState
        icon={ClipboardList}
        title={canManage ? (isExam ? 'Add the semester exam' : 'Add the first assessment') : 'No assessments yet'}
        description={
          canManage
            ? isExam
              ? 'Add the exam, then enter each student’s mark.'
              : 'Add a test, quiz or assignment for this period, then enter each student’s mark.'
            : 'The subject teacher hasn’t added any assessments for this period yet.'
        }
        action={addButton()}
      />
    );
  } else if (isDesk) {
    body = (
      <ScoreGrid
        sheet={sheet}
        saved={saved}
        drafts={drafts}
        readOnly={readOnly || saving}
        canManageAssessments={canManage}
        isExam={isExam}
        onUpdate={onUpdate}
        onComment={onComment}
        onEditAssessment={onEditAssessment}
        onDeleteAssessment={onDeleteAssessment}
      />
    );
  } else if (phoneAssessment) {
    body = (
      <div className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="phone-assessment" className="text-sm font-medium">
            Assessment
          </label>
          <div className="flex gap-2">
            <select
              id="phone-assessment"
              className={selectClass}
              value={phoneAssessment.id}
              onChange={(e) => setUrl({ assessment: e.target.value })}
            >
              {sheet.assessments.map((a) => {
                const unsaved = drafts[a.id] ? Object.keys(drafts[a.id]).length : 0;
                return (
                  <option key={a.id} value={a.id}>
                    {a.title} (out of {formatNumber(a.max_score)}){unsaved ? ` · ${unsaved} not saved` : ''}
                  </option>
                );
              })}
            </select>
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                className="size-12 shrink-0"
                onClick={() => setEditing({ assessment: phoneAssessment })}
              >
                <Pencil aria-hidden="true" />
                <span className="sr-only">Edit {phoneAssessment.title}</span>
              </Button>
            ) : null}
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                className="size-12 shrink-0 text-destructive"
                onClick={() => setDeleting(phoneAssessment)}
              >
                <Trash2 aria-hidden="true" />
                <span className="sr-only">Delete {phoneAssessment.title}</span>
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {KIND_LABELS[phoneAssessment.kind] ?? phoneAssessment.kind}
            {phoneAssessment.grading_category_id
              ? ` · ${sheet.categories.find((c) => c.id === phoneAssessment.grading_category_id)?.name ?? ''}`
              : ''}
          </p>
        </div>
        <ScoreList
          sheet={sheet}
          saved={saved}
          drafts={drafts}
          assessment={phoneAssessment}
          readOnly={readOnly || saving}
          onUpdate={onUpdate}
          onComment={onComment}
        />
        {addButton(true)}
      </div>
    );
  }

  const showSheetChrome = Boolean(sheet && target && !sheetQuery.isError);

  return (
    <PageShell
      title="Gradebook"
      description={description}
      primaryAction={showSheetChrome && !readOnly && sheet?.assessments.length ? saveButton : undefined}
      secondaryActions={showSheetChrome && sheet?.assessments.length && isDesk ? addButton() : undefined}
    >
      <GradebookPickers
        classes={classes}
        classId={classId}
        onClassChange={(id) => pick(() => setUrl({ class: id, subject: null, assessment: null }))}
        subjects={subjects}
        classSubjectId={classSubjectId}
        onSubjectChange={(id) => pick(() => setUrl({ subject: id, assessment: null }))}
        terms={options}
        term={term}
        onTermChange={(t) =>
          pick(() =>
            setUrl(
              t.type === 'exam'
                ? { exam: t.id, period: null, assessment: null }
                : { period: t.id, exam: null, assessment: null }
            )
          )
        }
        loadingClasses={classesLoading}
        loadingSubjects={Boolean(classId) && subjectsLoading}
        showTeacher={showTeacher}
      />

      {showSheetChrome && sheet ? (
        <div className="flex flex-col gap-3">
          {published ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
            >
              <Lock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold">
                  {isExam ? 'Results for this exam are published' : 'Results for this period are published'}
                </p>
                <p>
                  {correctsPublished && sheet.can_edit
                    ? 'You can still correct marks. Each change is recorded in the activity log.'
                    : 'Marks are read-only. Ask the principal to unpublish them if a mark needs to change.'}
                </p>
              </div>
            </div>
          ) : null}
          {viewerOnly ? (
            <div role="status" className="flex items-start gap-3 rounded-xl border bg-muted/50 p-4 text-sm">
              <Eye className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p>
                <span className="font-semibold">You can view these marks.</span> {FORBIDDEN_MESSAGE}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {classSubject ? subjectLabel(classSubject) : (sheet.subject?.name ?? '')}
              {sheet.teacher?.name ? ` · ${sheet.teacher.name}` : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span>{plural(sheet.students.length, 'student', 'students')}</span>
            {published ? <StatusBadge status="success" label="Published" /> : <StatusBadge status="pending" label="Not published" />}
            {dirty ? <StatusBadge status="warning" label={`${plural(changes.length, 'change', 'changes')} not saved`} /> : null}
            {invalid.length ? <StatusBadge status="danger" label={`${plural(invalid.length, 'mark', 'marks')} to fix`} /> : null}
            {sheetQuery.isFetching && !sheetQuery.isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-label="Updating" />
            ) : null}
          </div>
          {isDesk && !readOnly && sheet.assessments.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Tab or Enter moves down the column · Esc undoes a change · A = absent, E = excused, C = comment · Ctrl+S saves
            </p>
          ) : null}
        </div>
      ) : null}

      {body}

      {/* Phone: sticky save bar above the bottom navigation */}
      {!isDesk && showSheetChrome && !readOnly && sheet?.assessments.length ? (
        <div
          role="region"
          aria-label="Save marks"
          className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-xl border bg-background p-3 shadow-lg"
        >
          <p className="min-w-0 flex-1 text-sm" aria-live="polite">
            {invalid.length
              ? `Fix ${plural(invalid.length, 'mark', 'marks')} first`
              : dirty
                ? `${plural(changes.length, 'change', 'changes')} not saved`
                : 'All marks saved'}
          </p>
          <Button type="button" className="min-h-12 px-6 text-base" onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            Save scores
          </Button>
        </div>
      ) : null}

      {editing && term && classSubjectId && sheet ? (
        <AssessmentSheet
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          assessment={editing.assessment}
          classSubjectId={classSubjectId}
          term={term}
          categories={sheet.categories}
          subjectName={classSubject ? subjectLabel(classSubject) : (sheet.subject?.name ?? undefined)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? `Delete ${deleting.title}?` : 'Delete assessment?'}
        description={
          deletingEntered > 0
            ? `Its ${plural(deletingEntered, 'mark', 'marks')} will be deleted too, and period scores will change. This can't be undone.`
            : "No marks have been entered for it yet. This can't be undone."
        }
        confirmLabel="Delete assessment"
        destructive
        loading={deleteAssessment.isPending}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={pendingPick !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPick(null);
        }}
        title="Leave without saving?"
        description={`You have ${plural(changes.length, 'mark', 'marks')} that aren't saved. They'll be lost if you switch.`}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          const apply = pendingPick;
          setPendingPick(null);
          setDraftState({ key: '', drafts: {} });
          apply?.();
        }}
      />

      <ConfirmDialog
        open={guard.leaving}
        onOpenChange={(open) => {
          if (!open) guard.stay();
        }}
        title="Leave without saving?"
        description={`You have ${plural(changes.length, 'mark', 'marks')} that aren't saved. They'll be lost if you leave this page.`}
        confirmLabel="Leave page"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setDraftState({ key: '', drafts: {} });
          guard.leave();
        }}
      />

      <CommentSheet
        target={comment}
        readOnly={readOnly || saving}
        onClose={() => setComment(null)}
        onApply={(text) => {
          if (!comment) return;
          onUpdate(comment.assessmentId, comment.studentId, (current) => ({ ...current, comment: text }));
        }}
      />
    </PageShell>
  );
}
