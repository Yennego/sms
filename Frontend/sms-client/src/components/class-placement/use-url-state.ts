'use client';

// View state kept in the URL query (tab, filters, search, sort, page, page size), so a reload or a
// shared link opens the same view. Values equal to their default are left out of the URL.
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useUrlState<K extends string>(defaults: Record<K, string>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Defaults are a literal at the call site; key on their content so callbacks stay stable.
  const defaultsKey = JSON.stringify(defaults);
  const stableDefaults = React.useMemo(() => JSON.parse(defaultsKey) as Record<K, string>, [defaultsKey]);

  const values = React.useMemo(() => {
    const out = {} as Record<K, string>;
    for (const key of Object.keys(stableDefaults) as K[]) {
      out[key] = searchParams.get(key) ?? stableDefaults[key];
    }
    return out;
  }, [searchParams, stableDefaults]);

  const update = React.useCallback(
    (patch: Partial<Record<K, string | number | null>>) => {
      // Read the live URL so two quick updates don't overwrite each other.
      const current = typeof window !== 'undefined' ? window.location.search : searchParams.toString();
      const next = new URLSearchParams(current);
      for (const [key, raw] of Object.entries(patch) as [K, string | number | null | undefined][]) {
        const value = raw === null || raw === undefined ? stableDefaults[key] : String(raw);
        if (value === stableDefaults[key]) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, stableDefaults]
  );

  return [values, update] as const;
}

/** A search box value that writes to the URL ~300 ms after typing stops. */
export function useDebouncedSearch(urlValue: string, onCommit: (value: string) => void, delay = 300) {
  const [text, setText] = React.useState(urlValue);
  const commitRef = React.useRef(onCommit);
  React.useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);

  // Follow the URL when it changes from elsewhere (back button, "Clear search").
  const lastUrlValue = React.useRef(urlValue);
  React.useEffect(() => {
    if (urlValue !== lastUrlValue.current) {
      lastUrlValue.current = urlValue;
      setText(urlValue);
    }
  }, [urlValue]);

  React.useEffect(() => {
    if (text.trim() === urlValue.trim()) return;
    const timer = setTimeout(() => {
      lastUrlValue.current = text.trim();
      commitRef.current(text.trim());
    }, delay);
    return () => clearTimeout(timer);
  }, [text, urlValue, delay]);

  return [text, setText] as const;
}

/** Parse a positive integer from the URL, falling back when it is missing or invalid. */
export function positiveInt(value: string, fallback: number, allowed?: readonly number[]): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (allowed && !allowed.includes(n)) return fallback;
  return n;
}
