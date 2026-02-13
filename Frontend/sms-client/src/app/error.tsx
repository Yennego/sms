'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-destructive mb-4">Something went wrong!</h1>
        <p className="text-muted-foreground mb-8">
          An unexpected error has occurred. Please notify our team.
        </p>
        <Button onClick={reset} variant="outline" className="mr-4">
          Try again
        </Button>
        <Button onClick={() => window.location.href = '/'} variant="default">
          Return to Home
        </Button>
      </div>
    </div>
  );
}