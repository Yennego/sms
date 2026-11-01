import { redirect } from 'next/navigation';

// Exam marks are part of "My results" (published results only).
export default async function StudentExamsPage({ params }: { params: Promise<{ tenantDomain: string }> }) {
  const { tenantDomain } = await params;
  redirect(`/${tenantDomain}/student/grades`);
}
