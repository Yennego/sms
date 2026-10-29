import { TeacherProfile } from "@/components/staff/teacher-profile"
import { parseProfileTab } from "@/components/staff/staff-format"

// Staff profile with tabs in the URL (?tab=overview | classes | sponsor)
export default async function TeacherProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantDomain: string; id: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tenantDomain, id } = await params
  const { tab } = await searchParams
  return <TeacherProfile schoolSlug={tenantDomain} teacherId={id} tab={parseProfileTab(tab)} />
}
