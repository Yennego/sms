// Small display helpers shared by the Staff screens.

import type { StatusBadgeStatus } from "@/components/ui/status-badge"
import type { StaffClass, StaffMember } from "@/services/api/staff-service"

export function fullName(t: Pick<StaffMember, "first_name" | "last_name">): string {
  return `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Unnamed teacher"
}

const STATUS: Record<string, { status: StatusBadgeStatus; label: string }> = {
  active: { status: "success", label: "Active" },
  inactive: { status: "neutral", label: "Inactive" },
  retired: { status: "neutral", label: "Retired" },
  resigned: { status: "neutral", label: "Resigned" },
}

export function staffStatus(value: string | null | undefined): { status: StatusBadgeStatus; label: string } {
  return STATUS[(value ?? "").toLowerCase()] ?? { status: "neutral", label: value || "Unknown" }
}

export function className(c: Pick<StaffClass, "name" | "grade_name" | "section_name">): string {
  if (c.name && c.name.trim()) return c.name
  return [c.grade_name, c.section_name].filter(Boolean).join(" ") || "Unnamed class"
}

/** "Mon 20 Oct 2026" (design brief, content style). */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function statusCodeOf(error: unknown): number | undefined {
  return (error as { statusCode?: number } | null)?.statusCode
}

export type ProfileTab = "overview" | "classes" | "sponsor"

/** Reads ?tab= for the staff profile; anything unknown shows the overview. */
export function parseProfileTab(value: string | string[] | undefined): ProfileTab {
  const v = Array.isArray(value) ? value[0] : value
  return v === "classes" || v === "sponsor" ? v : "overview"
}
