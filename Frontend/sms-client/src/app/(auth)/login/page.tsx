'use client';

// /login without a school: every account belongs to one school, so people sign in on their
// school's page (/{school}/login). This page finds the school: the one they used last, or the
// one they type (its web address name, code or name). Platform operators have their own page.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currentSchoolSlug } from '@/utils/tenant-utils';

export default function FindYourSchoolPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [checkedMemory, setCheckedMemory] = useState(false);

  // Back to the school this browser signed in to last
  useEffect(() => {
    const slug = currentSchoolSlug();
    if (slug) router.replace(`/${slug}/login`);
    else setCheckedMemory(true);
  }, [router]);

  const findSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tenants/by-domain/?domain=${encodeURIComponent(value)}`, { cache: 'no-store' });
      const school = res.ok ? await res.json() : null;
      const slug = school?.domain || school?.subdomain;
      if (!slug) {
        setError(`We couldn't find a school called "${value}". Check the spelling, or ask your school for its web address.`);
        return;
      }
      router.push(`/${String(slug).toLowerCase()}/login`);
    } catch {
      setError('The school list could not be reached. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  if (!checkedMemory) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
        <span className="sr-only">Opening your school&apos;s sign-in page…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-md">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <School className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Find your school</h1>
          <p className="text-sm text-slate-600">You sign in on your school&apos;s own page.</p>
        </div>

        <form onSubmit={findSchool} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="school">School web address or code</Label>
            <Input
              id="school"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. foundation"
              autoCapitalize="none"
              autoComplete="organization"
              spellCheck={false}
              className="h-11"
              disabled={searching}
              required
            />
            <p className="text-xs text-slate-500">
              It&apos;s the name after the slash in your school&apos;s link, like <span className="font-mono">/foundation</span>.
            </p>
          </div>
          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <Button type="submit" className="h-11 w-full" disabled={searching}>
            {searching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Finding your school…</> : 'Go to sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500">
          Platform operator?{' '}
          <Link href="/platform/login" className="font-medium text-indigo-600 hover:underline">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}
