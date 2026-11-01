import { redirect } from 'next/navigation';

// Replaced in Phase 6: alert emails are set per user under Notification settings.
export default async function Page({ params }: { params: Promise<{ tenantDomain: string }> }) {
  const { tenantDomain } = await params;
  redirect(`/${tenantDomain}/settings/notifications`);
}
