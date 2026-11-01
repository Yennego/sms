'use client';

// Add or edit an assessment column (POST / PUT /academics/gradebook/assessments).
// For a period: title, kind, category (decides the weight), max score, date.
// For the semester exam: the kind is "exam" and there is no category.
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import {
  errorStatus,
  errorText,
  KIND_LABELS,
  PERIOD_KINDS,
  type AssessmentInput,
  type GradingCategory,
  type SheetAssessment,
} from '@/services/api/gradebook-service';
import type { TermOption } from './gradebook-utils';
import { selectClass } from './gradebook-pickers';
import { useCreateAssessment, useUpdateAssessment } from './queries';

const kindValues = ['test', 'quiz', 'assignment', 'project', 'participation', 'exam', 'other'] as const;

function makeSchema(isExam: boolean) {
  return z.object({
    title: z.string().trim().min(1, 'Enter a title, e.g. "Test 1"').max(200, 'Use 200 characters or fewer'),
    kind: z.enum(kindValues),
    grading_category_id: isExam ? z.string() : z.string().min(1, 'Choose a category'),
    max_score: z
      .string()
      .trim()
      .min(1, 'Enter the highest possible score')
      .refine((v) => /^\d+([.,]\d+)?$/.test(v) && Number(v.replace(',', '.')) > 0, 'Enter a number above 0, e.g. 20')
      .refine((v) => Number(v.replace(',', '.')) <= 1000, 'Use 1000 or less'),
    assessment_date: z.string(),
    description: z.string().max(1000, 'Use 1000 characters or fewer'),
  });
}

type Values = z.infer<ReturnType<typeof makeSchema>>;

/** A category whose name matches the kind ("Tests" for a test), if any. */
function guessCategory(kind: string, categories: GradingCategory[]): string {
  const match = categories.find((c) => c.name.toLowerCase().startsWith(kind.toLowerCase().slice(0, 4)));
  return match?.id ?? (categories.length === 1 ? categories[0].id : '');
}

function initialValues(
  assessment: SheetAssessment | null,
  isExam: boolean,
  categories: GradingCategory[]
): Values {
  if (assessment) {
    return {
      title: assessment.title,
      kind: assessment.kind,
      grading_category_id: assessment.grading_category_id ?? '',
      max_score: String(assessment.max_score),
      assessment_date: assessment.assessment_date?.slice(0, 10) ?? '',
      description: assessment.description ?? '',
    };
  }
  const kind = isExam ? 'exam' : 'test';
  return {
    title: isExam ? 'Semester exam' : '',
    kind,
    grading_category_id: isExam ? '' : guessCategory(kind, categories),
    max_score: '100',
    assessment_date: '',
    description: '',
  };
}

export function AssessmentSheet({
  open,
  onOpenChange,
  assessment,
  classSubjectId,
  term,
  categories,
  subjectName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add a new assessment. */
  assessment: SheetAssessment | null;
  classSubjectId: string;
  term: TermOption;
  categories: GradingCategory[];
  subjectName?: string;
}) {
  const formId = React.useId();
  const isExam = term.type === 'exam';
  const create = useCreateAssessment();
  const update = useUpdateAssessment();
  const pending = create.isPending || update.isPending;
  const schema = React.useMemo(() => makeSchema(isExam), [isExam]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, dirtyFields },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(assessment, isExam, categories),
  });

  React.useEffect(() => {
    if (open) reset(initialValues(assessment, isExam, categories));
  }, [open, assessment, isExam, categories, reset]);

  // Suggest the matching category when the kind changes (unless the user picked one).
  const kind = watch('kind');
  React.useEffect(() => {
    if (isExam || dirtyFields.grading_category_id) return;
    const guess = guessCategory(kind, categories);
    if (guess && guess !== getValues('grading_category_id')) setValue('grading_category_id', guess);
  }, [kind, isExam, categories, dirtyFields.grading_category_id, getValues, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const payload: AssessmentInput = {
      kind: isExam ? 'exam' : values.kind,
      period_id: isExam ? null : term.id,
      semester_id: isExam ? term.id : null,
      grading_category_id: isExam ? null : values.grading_category_id || null,
      title: values.title.trim(),
      description: values.description.trim() || null,
      assessment_date: values.assessment_date || null,
      max_score: Number(values.max_score.replace(',', '.')),
    };
    try {
      if (assessment) {
        await update.mutateAsync({ id: assessment.id, payload });
        notify.success('Assessment saved');
      } else {
        await create.mutateAsync({ ...payload, class_subject_id: classSubjectId });
        notify.success(`${payload.title} added`, { description: 'Enter the scores in its column.' });
      }
      onOpenChange(false);
    } catch (error) {
      const status = errorStatus(error);
      if (status === 403) {
        notify.error("Your role can't change these marks.");
      } else {
        notify.error(errorText(error, "We couldn't save this assessment. Check the details and try again."));
      }
    }
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={assessment ? 'Edit assessment' : isExam ? 'Add the semester exam' : 'Add assessment'}
      description={[subjectName, term.label].filter(Boolean).join(' · ')}
      className="sm:max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {assessment ? 'Save assessment' : 'Add assessment'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-5">
        <FormField label="Title" error={errors.title?.message} required>
          <Input className="h-12 text-base md:h-10 md:text-sm" autoComplete="off" {...register('title')} />
        </FormField>

        {isExam ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Each semester has one exam per subject. It counts as one quarter of the semester average.
          </p>
        ) : (
          <>
            <FormField label="Kind" error={errors.kind?.message} required>
              <select className={selectClass} {...register('kind')}>
                {PERIOD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Category"
              error={errors.grading_category_id?.message}
              description={
                categories.length
                  ? 'The category decides how much this counts in the period score.'
                  : 'This subject has no grading categories. Set them up in Grading settings first.'
              }
              required
            >
              <select className={selectClass} {...register('grading_category_id')} disabled={!categories.length}>
                <option value="">Choose a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.weight}%)
                  </option>
                ))}
              </select>
            </FormField>
          </>
        )}

        <FormField
          label="Highest possible score"
          error={errors.max_score?.message}
          description="Scores can be entered from 0 up to this number."
          required
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            className="h-12 text-base md:h-10 md:text-sm"
            {...register('max_score')}
          />
        </FormField>

        <FormField label="Date" error={errors.assessment_date?.message}>
          <Input type="date" className="h-12 text-base md:h-10 md:text-sm" {...register('assessment_date')} />
        </FormField>

        <FormField label="Notes" error={errors.description?.message}>
          <Textarea rows={3} {...register('description')} />
        </FormField>
      </form>
    </Sheet>
  );
}
