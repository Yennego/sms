'use client';

// Change password (/{school}/change-password): required on the first sign-in with an issued
// password, and reached from the user menu. On success the user goes to their role's home page.
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { AuthCard } from '@/components/auth/password-reset-forms';
import { PasswordInput } from '@/components/auth/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { contextualCookies, getCurrentContext } from '@/utils/cookie-manager';
import { homePath } from '@/config/navigation';

type Step = 'idle' | 'saving' | 'opening';

export const PASSWORD_RULES = 'At least 8 characters, with upper and lower case letters, a number and a symbol.';

/** The server's reason a password change was refused, in plain words. */
export function passwordChangeError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  const message = typeof detail === 'string'
    ? detail
    : Array.isArray((detail as { errors?: string[] })?.errors)
      ? (detail as { errors: string[] }).errors.join(' ')
      : err instanceof Error && err.message ? err.message : "Your password wasn't changed. Check your connection and try again.";
  return message === 'Incorrect password' ? 'Your current password is incorrect.' : message;
}

/** Problems with the new password the browser can see before asking the server. */
export function newPasswordProblem(newPassword: string, confirmPassword: string): string | null {
  if (newPassword.length < 8) return 'The new password must be at least 8 characters long.';
  if (newPassword !== confirmPassword) return "The new passwords don't match. Type the same password twice.";
  return null;
}

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const { changePassword, user, requiresPasswordChange } = useAuth();
  const router = useRouter();
  const params = useParams();

  // The school's address name: from the page URL (/{school}/change-password), else from the session
  const schoolSlug = (params?.tenantDomain as string | undefined)
    || contextualCookies.get('currentTenantDomain', getCurrentContext())
    || (typeof window !== 'undefined' ? localStorage.getItem('currentTenantDomain') : null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const problem = newPasswordProblem(newPassword, confirmPassword);
    if (problem) {
      setError(problem);
      return;
    }

    setStep('saving');
    try {
      await changePassword(currentPassword, newPassword);
      // Keep the loader up until the home page has replaced this page
      setStep('opening');
      router.replace(homePath(user, schoolSlug));
    } catch (err: unknown) {
      setError(passwordChangeError(err));
      setStep('idle');
    }
  };

  const busy = step !== 'idle';

  return (
    <>
      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-sm"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
          <p className="text-base font-medium text-foreground">
            {step === 'saving' ? 'Saving your new password…' : 'Password changed. Opening your home page…'}
          </p>
        </div>
      )}

      <AuthCard
        title="Change your password"
        subtitle={requiresPasswordChange
          ? 'Choose your own password before you continue. The one you were given stops working.'
          : 'Choose a new password for signing in.'}
      >
        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Current password">
            <PasswordInput
              id="current-password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={busy}
              className="h-11"
            />
          </FormField>
          <FormField label="New password" description={PASSWORD_RULES}>
            <PasswordInput
              id="new-password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={busy}
              className="h-11"
            />
          </FormField>
          <FormField label="Type the new password again">
            <PasswordInput
              id="confirm-password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              className="h-11"
            />
          </FormField>

          <Button type="submit" disabled={busy} className="h-11 w-full text-base font-semibold">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Changing password…' : 'Change password'}
          </Button>
        </form>

        {/* From the user menu (not a required change): a way back without changing it */}
        {!requiresPasswordChange && user ? (
          <p className="text-center text-sm">
            <Link href={homePath(user, schoolSlug)} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
              Back to your home page
            </Link>
          </p>
        ) : null}
      </AuthCard>
    </>
  );
}
