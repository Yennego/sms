import { StaffDirectory } from "@/components/staff/staff-directory"

// Staff directory (app flow, section 3: Staff)
export default async function TeachersPage({ params }: { params: Promise<{ tenantDomain: string }> }) {
  const { tenantDomain } = await params
  return <StaffDirectory schoolSlug={tenantDomain} />
}
