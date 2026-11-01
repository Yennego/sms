'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth/password-reset-forms';

export default function TenantResetPasswordPage() {
  const params = useParams();
  const tenantDomain = (params?.tenantDomain as string) || '';
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm tenantDomain={tenantDomain} />
    </Suspense>
  );
}
