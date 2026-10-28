// There is no self-service sign-up: school staff create every account (students, parents,
// teachers) and hand out the sign-in details.
import Link from 'next/link';
import { AuthCard } from '@/components/auth/password-reset-forms';

export default function RegisterPage() {
  return (
    <AuthCard title="Need an account?">
      <p className="text-sm text-slate-600">
        Accounts are created by your school office. Ask them to set one up for you; they will give you
        your sign-in email and a temporary password, which you change the first time you sign in.
      </p>
      <p className="text-sm text-slate-600">
        Already have an account? Sign in from your school&apos;s sign-in page.
      </p>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">Go to sign in</Link>
      </p>
    </AuthCard>
  );
}
