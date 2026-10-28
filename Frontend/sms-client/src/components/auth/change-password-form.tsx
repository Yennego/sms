'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PasswordInput } from '@/components/auth/password-input';
import { contextualCookies, getCurrentContext } from '@/utils/cookie-manager';

type Step = 'idle' | 'saving' | 'opening';

const ROLE_HOMES: Record<string, string> = {
  admin: '/admin-dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
  parent: '/parent/attendance',
  'attendance-scanner': '/attendance/scan',
};
const SUPER_ADMIN_ROLES = ['super-admin', 'superadmin', 'super_admin'];

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const { changePassword, user } = useAuth();
  const router = useRouter();
  const params = useParams();

  // The school's address name: from the page URL (/{school}/change-password), else from the session
  const schoolSlug = (params?.tenantDomain as string | undefined)
    || contextualCookies.get('currentTenantDomain', getCurrentContext())
    || (typeof window !== 'undefined' ? localStorage.getItem('currentTenantDomain') : null);

  const homePath = () => {
    const roles = [
      user?.role,
      ...(Array.isArray(user?.roles) ? user.roles.map((r) => (typeof r === 'string' ? r : r.name)) : []),
    ].filter((r): r is string => !!r);
    if (roles.some((r) => SUPER_ADMIN_ROLES.includes(r))) return '/super-admin/dashboard';
    const home = roles.map((r) => ROLE_HOMES[r]).find(Boolean) || '/dashboard';
    return schoolSlug ? `/${schoolSlug}${home}` : '/login';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('The new passwords don\'t match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('The new password must be at least 8 characters long.');
      return;
    }

    setStep('saving');
    try {
      await changePassword(currentPassword, newPassword);
      // Keep the loader up until the dashboard has replaced this page
      setStep('opening');
      router.replace(homePath());
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray((detail as { errors?: string[] })?.errors)
          ? (detail as { errors: string[] }).errors.join(' ')
          : err instanceof Error ? err.message : 'Your password could not be changed. Try again.';
      setError(message === 'Incorrect password' ? 'Your current password is incorrect.' : message);
      setStep('idle');
    }
  };

  const busy = step !== 'idle';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/90 backdrop-blur-sm"
        >
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-base font-medium text-gray-700">
            {step === 'saving' ? 'Saving your new password…' : 'Password changed. Opening your dashboard…'}
          </p>
        </div>
      )}

      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Change your password</h2>
          <p className="mt-2 text-sm text-gray-600">
            You must change your password before continuing
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {[
              { id: 'current-password', label: 'Current password', value: currentPassword, set: setCurrentPassword,
                placeholder: 'Enter your current password', autoComplete: 'current-password' },
              { id: 'new-password', label: 'New password', value: newPassword, set: setNewPassword,
                placeholder: 'At least 8 characters, with upper and lower case, a number and a symbol', autoComplete: 'new-password' },
              { id: 'confirm-password', label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword,
                placeholder: 'Type the new password again', autoComplete: 'new-password' },
            ].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                <PasswordInput
                  id={field.id}
                  required
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  disabled={busy}
                  className="h-11"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="group relative w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Changing password…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
