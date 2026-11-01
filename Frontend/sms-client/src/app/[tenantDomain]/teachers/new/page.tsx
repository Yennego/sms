import { AddTeacherForm } from "@/components/staff/add-teacher-form"

// Staff: add a teacher
export default async function NewTeacherPage({ params }: { params: Promise<{ tenantDomain: string }> }) {
  const { tenantDomain } = await params
  return <AddTeacherForm schoolSlug={tenantDomain} />
}
