'use client';

// Forgot / reset password forms for a school's pages (/{tenantDomain}/forgot-password and
// /{tenantDomain}/reset-password). They call the public server routes in /api/auth/*, naming the
// school from the URL; no session or token is involved in the browser.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordInput } from '@/components/auth/password-input';

const NO_EMAIL_HINT = 'No email? Ask your school office to reset your password.';

async function postPublicAuth(path: string, tenantDomain: string, body: Record<string, string>): Promise<string> {
  const res = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantDomain },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as { message?: string; detail?: string } | null;
  if (!res.ok) throw new Error(data?.detail || 'Something went wrong. Please try again.');
  return data?.message || '';
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-100 mb-2">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-slate-500">{subtitle}</p>}
        </div>
        <Card className="border-slate-200 shadow-xl shadow-slate-200/50">
          <CardContent className="pt-6 space-y-4">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function SuccessAlert({ message }: { message: string }) {
  return (
    <Alert className="bg-green-50 border-green-100 text-green-800">
      <CheckCircle2 className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function BackToSignIn({ tenantDomain }: { tenantDomain: string }) {
  return (
    <p className="text-center text-sm">
      <Link href={`/${tenantDomain}/login`} className="font-medium text-primary hover:underline">
        Back to sign in
      </Link>
    </p>
  );
}

export function ForgotPasswordForm({ tenantDomain }: { tenantDomain: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const message = await postPublicAuth('forgot-password', tenantDomain, { email: email.trim() });
      setSentMessage(message || 'If an account with that email exists at this school, we have sent it a reset link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard title="Forgot your password?" subtitle="Enter the email address on your school account and we'll send you a reset link.">
      {sentMessage ? (
        <SuccessAlert message={sentMessage} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@school.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 h-11"
                disabled={isLoading}
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-11" disabled={isLoading}>
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : 'Send reset link'}
          </Button>
        </form>
      )}
      <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-md p-3">{NO_EMAIL_HINT}</p>
      <BackToSignIn tenantDomain={tenantDomain} />
    </AuthCard>
  );
}

export function ResetPasswordForm({ tenantDomain }: { tenantDomain: string }) {
  const searchParams = useSearchParams();
  // Read once: the token is then removed from the address bar (and from any Referer header)
  const [token] = useState(() => searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token && typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const message = await postPublicAuth('reset-password', tenantDomain, { token, new_password: password });
      setDoneMessage(message || 'Your password has been reset.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (doneMessage) {
    return (
      <AuthCard title="Password reset">
        <SuccessAlert message={doneMessage} />
        <Button asChild className="w-full h-11">
          <Link href={`/${tenantDomain}/login`}>Sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  if (!token) {
    return (
      <AuthCard title="Reset your password">
        <ErrorAlert message="This reset link is incomplete. Open the link from your email again, or request a new one." />
        <Button asChild variant="outline" className="w-full h-11">
          <Link href={`/${tenantDomain}/forgot-password`}>Request a new link</Link>
        </Button>
        <p className="text-sm text-slate-600">{NO_EMAIL_HINT}</p>
        <BackToSignIn tenantDomain={tenantDomain} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        {[
          { id: 'password', label: 'New password', value: password, set: setPassword },
          { id: 'confirmPassword', label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword },
        ].map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            <PasswordInput
              id={field.id}
              withIcon
              autoComplete="new-password"
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              required
              className="h-11"
              disabled={isLoading}
            />
          </div>
        ))}
        <Button type="submit" className="w-full h-11" disabled={isLoading}>
          {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Reset password'}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href={`/${tenantDomain}/forgot-password`} className="text-primary hover:underline">
          Request a new link
        </Link>
      </p>
      <BackToSignIn tenantDomain={tenantDomain} />
    </AuthCard>
  );
}
