'use client';

// One search param as state (e.g. ?child= and ?year=), so a reload or a shared link keeps the choice.
// Pages using it must render inside <Suspense> (useSearchParams).
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useUrlParam(name: string): [string, (value: string, extra?: Record<string, string>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(name) ?? '';
  const set = React.useCallback(
    (next: string, extra: Record<string, string> = {}) => {
      const qs = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries({ [name]: next, ...extra })) {
        if (v) qs.set(k, v);
        else qs.delete(k);
      }
      const query = qs.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [name, pathname, router, searchParams]
  );
  return [value, set];
}
