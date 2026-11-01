'use client';

import { useParams } from 'next/navigation';
import { ForgotPasswordForm } from '@/components/auth/password-reset-forms';

export default function TenantForgotPasswordPage() {
  const params = useParams();
  const tenantDomain = (params?.tenantDomain as string) || '';
  return <ForgotPasswordForm tenantDomain={tenantDomain} />;
}
