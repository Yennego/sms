import { redirect } from 'next/navigation';

// Replaced in Phase 5: fee categories are part of Fee setup.
export default async function Page({ params }: { params: Promise<{ tenantDomain: string }> }) {
  const { tenantDomain } = await params;
  redirect(`/${tenantDomain}/finance/structures?section=categories`);
}
