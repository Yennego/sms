import { redirect } from 'next/navigation';

// Assessments and marks now live in the gradebook (docs/remodel/phase4-design.md).
export default async function OldGradingPage({ params }: { params: Promise<{ tenantDomain: string }> }) {
  const { tenantDomain } = await params;
  redirect(`/${tenantDomain}/academics/gradebook`);
}
