'use client';

// Loading, retry and "no children" states shared by the parent screens. Plain words, big buttons.
import * as React from 'react';
import { AlertTriangle, RotateCcw, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export function ParentSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label={label}>
      <Skeleton className="h-11 w-48 rounded-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}

export function RetryState({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={`${what} did not load`}
      description="Check your internet connection and try again."
      action={
        <Button variant="outline" className="min-h-11 text-base" onClick={onRetry}>
          <RotateCcw aria-hidden="true" /> Try again
        </Button>
      }
    />
  );
}

export function NoChildrenState() {
  return (
    <EmptyState
      icon={Users}
      title="No children linked"
      description="No children are linked to your account. Please ask the school office."
    />
  );
}
