// Accounts belong to one school, so password resets start on the school's own page
// (/{school}/forgot-password). This page only points people there.
import Link from 'next/link';
import { AuthCard } from '@/components/auth/password-reset-forms';

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?">
      <p className="text-sm text-slate-600">
        Open your school&apos;s sign-in page (the address your school gave you) and choose
        <span className="font-medium"> Forgot password?</span> there. We&apos;ll email you a link to choose a new password.
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
