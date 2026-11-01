import { redirect } from 'next/navigation';

// Replaced in Phase 5: the fees overview and reports replace the revenue dashboard.
export default async function Page({ params }: { params: Promise<{ tenantDomain: string }> }) {
  const { tenantDomain } = await params;
  redirect(`/${tenantDomain}/finance`);
}
