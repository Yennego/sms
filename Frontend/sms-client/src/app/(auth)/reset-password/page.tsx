// Reset links are always for a school page (/{school}/reset-password?token=...). Without a
// school we can't use a token, so this page only explains what to do.
import Link from 'next/link';
import { AuthCard } from '@/components/auth/password-reset-forms';

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Reset your password">
      <p className="text-sm text-slate-600">
        This link is incomplete. Open the reset link from your email again, or ask for a new one from
        your school&apos;s sign-in page with <span className="font-medium">Forgot password?</span>
      </p>
      <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-md p-3">
        No email? Ask your school office to reset your password.
      </p>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
      </p>
    </AuthCard>
  );
}
