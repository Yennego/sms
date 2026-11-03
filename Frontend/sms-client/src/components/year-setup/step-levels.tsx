'use client';

import * as React from 'react';
import { Layers, Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { notify } from '@/components/ui/toaster';
import type { YearSetup, YearSetupLevel } from '@/services/api/year-setup-service';
import { errorText, type YearSetupMutations } from './use-year-setup';

export interface StepLevelsProps {
  data: YearSetup;
  mutations: YearSetupMutations;
}

export function StepLevels({ data, mutations }: StepLevelsProps) {
  const levels = [...data.steps.levels.levels].sort((a, b) => a.sequence - b.sequence);
  const nextSequence = levels.reduce((max, l) => Math.max(max, l.sequence), 0) + 1;
  const [adding, setAdding] = React.useState(levels.length === 0);

  return (
    <div className="space-y-4">
      {levels.length === 0 && !adding ? (
        <EmptyState
          icon={Layers}
          title="No grade levels yet"
          description="Add your first grade level, for example Grade 1, then its sections."
          action={<Button onClick={() => setAdding(true)}>Add a grade level</Button>}
        />
      ) : null}

      {levels.length > 0 ? (
        <ul className="space-y-3">
          {levels.map((level) => (
            <LevelRow key={level.id} level={level} mutations={mutations} />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <AddLevelForm nextSequence={nextSequence} mutations={mutations} onDone={() => setAdding(false)} />
      ) : levels.length > 0 ? (
        <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          Add a grade level
        </Button>
      ) : null}
    </div>
  );
}

function LevelRow({ level, mutations }: { level: YearSetupLevel; mutations: YearSetupMutations }) {
  const [adding, setAdding] = React.useState(false);
  return (
    <li className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{level.name}</h3>
        {level.sections.length === 0 ? <StatusBadge status="warning" label="No sections" /> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {level.sections.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-sm">
            <span className="font-medium">{s.name}</span>
          </span>
        ))}
        {!adding ? (
          <Button variant="ghost" className="min-h-11 md:min-h-9" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add section
            <span className="sr-only"> to {level.name}</span>
          </Button>
        ) : null}
      </div>
      {adding ? <AddSectionForm level={level} mutations={mutations} onDone={() => setAdding(false)} /> : null}
    </li>
  );
}

function nextSectionName(level: YearSetupLevel): string {
  const used = new Set(level.sections.map((s) => s.name.toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return letter;
  }
  return '';
}

function AddSectionForm({ level, mutations, onDone }: { level: YearSetupLevel; mutations: YearSetupMutations; onDone: () => void }) {
  const [name, setName] = React.useState(() => nextSectionName(level));
  const [errors, setErrors] = React.useState<{ name?: string }>({});
  const { createSection } = mutations;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Enter a section name, for example A.';
    else if (level.sections.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      next.name = `${level.name} already has section ${name.trim()}.`;
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await createSection.mutateAsync({ grade_id: level.id, name: name.trim() });
      notify.success(`Section ${name.trim()} added to ${level.name}.`);
      onDone();
    } catch (err) {
      notify.error(errorText(err, 'The section was not added.'));
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[1fr_auto] sm:items-start" noValidate>
      <FormField label="Section name" error={errors.name} required>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 bg-background" autoFocus />
      </FormField>
      <div className="flex gap-2 sm:pt-[1.375rem]">
        <Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11 flex-1 sm:flex-none" disabled={createSection.isPending}>
          {createSection.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Add section
        </Button>
      </div>
    </form>
  );
}

function AddLevelForm({ nextSequence, mutations, onDone }: { nextSequence: number; mutations: YearSetupMutations; onDone: () => void }) {
  const [name, setName] = React.useState('');
  const [sequence, setSequence] = React.useState(String(nextSequence));
  const [errors, setErrors] = React.useState<{ name?: string; sequence?: string }>({});
  const { createLevel } = mutations;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const seq = Number(sequence);
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Enter a level name, for example Grade 1.';
    if (!Number.isInteger(seq) || seq < 0) next.sequence = 'Enter a whole number for the order.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await createLevel.mutateAsync({ name: name.trim(), sequence: seq });
      notify.success(`${name.trim()} added. Now add its sections.`);
      onDone();
    } catch (err) {
      notify.error(errorText(err, 'The grade level was not added.'));
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[2fr_1fr_auto] sm:items-start" noValidate>
      <FormField label="Level name" error={errors.name} required>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" placeholder="Grade 1" autoFocus />
      </FormField>
      <FormField label="Order" description="Lower numbers come first." error={errors.sequence} required>
        <Input type="number" inputMode="numeric" min={0} value={sequence} onChange={(e) => setSequence(e.target.value)} className="h-11" />
      </FormField>
      <div className="flex gap-2 sm:pt-[1.375rem]">
        <Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11 flex-1 sm:flex-none" disabled={createLevel.isPending}>
          {createLevel.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Add level
        </Button>
      </div>
    </form>
  );
}
