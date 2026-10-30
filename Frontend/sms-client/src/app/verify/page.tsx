'use client';

// Public report card check without a QR scan: type the code printed on the card (phase4-design.md
// section 7) and go to /verify/{code}. No sign-in, outside any school. Dashes, spaces and lower
// case are accepted; the code is sent as 12 uppercase characters.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CODE_LENGTH = 12;

export default function VerifyCodeEntryPage() {
  const router = useRouter();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    document.title = 'Check a report card';
  }, []);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = value.replace(/[\s-]/g, '').toUpperCase();
    if (code.length !== CODE_LENGTH || !/^[0-9A-Z]+$/.test(code)) {
      setError(`Type the ${CODE_LENGTH} letters and numbers under the QR code, like 7K2M-9QXR-4T8B.`);
      return;
    }
    setError(null);
    router.push(`/verify/${encodeURIComponent(code)}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:py-10">
      <div className="mx-auto w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Check a report card</h1>
        <p className="text-base text-slate-700">
          Every report card has a QR code and a code under it. Scan the QR code, or type the code here.
        </p>
        <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Label htmlFor="verify-code" className="text-base">
            Enter the code printed on the report card
          </Label>
          <Input
            id="verify-code"
            name="code"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="7K2M-9QXR-4T8B"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            maxLength={32}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'verify-code-error' : undefined}
            className="h-12 font-mono text-lg tracking-wider uppercase"
          />
          {error ? (
            <p id="verify-code-error" role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11 w-full text-base">
            <Search className="size-4" aria-hidden="true" />
            Check report card
          </Button>
        </form>
        <p className="text-center text-xs text-slate-500">
          This page checks a printed report card against the school&rsquo;s records.
        </p>
      </div>
    </main>
  );
}
