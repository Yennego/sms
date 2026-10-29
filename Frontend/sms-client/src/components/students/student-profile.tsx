"use client"

// Student profile: header (name, admission no., username, class, status), tabs kept in the URL
// (?tab=), and the actions edit details / reset password / deactivate.

import * as React from "react"
import Link from "next/link"
import { KeyRound, Pencil, UserCheck, UserX, UserRoundX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, type DropdownMenuEntry } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { PageShell } from "@/components/ui/page-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/ui/status-badge"
import { notify } from "@/components/ui/toaster"
import { CredentialsDialog, type Credential } from "./credentials"
import { EditStudentSheet } from "./edit-student-sheet"
import { enrollmentClassName, errorMessage, fullName, isNotFound, studentStatusBadge } from "./format"
import {
  AttendanceTab,
  EnrollmentTab,
  FeesTab,
  GuardiansTab,
  IdCardTab,
  OverviewTab,
  ResultsTab,
} from "./profile-tabs"
import { useResetPassword, useSetStudentStatus, useStudentEnrollments, useStudentRecord } from "./queries"

export const PROFILE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "enrollment", label: "Enrollment" },
  { key: "attendance", label: "Attendance" },
  { key: "results", label: "Results" },
  { key: "fees", label: "Fees" },
  { key: "guardians", label: "Guardians" },
  { key: "id-card", label: "ID card" },
] as const

export type ProfileTab = (typeof PROFILE_TABS)[number]["key"]

export function isProfileTab(value: string | null): value is ProfileTab {
  return PROFILE_TABS.some((t) => t.key === value)
}

export function StudentProfile({ school, studentId, tab }: { school: string; studentId: string; tab: ProfileTab }) {
  const studentQ = useStudentRecord(studentId)
  const enrollmentsQ = useStudentEnrollments(studentId)
  const setStatus = useSetStudentStatus(studentId)
  const resetPassword = useResetPassword()

  const [editing, setEditing] = React.useState(false)
  const [confirmStatus, setConfirmStatus] = React.useState(false)
  const [resetTarget, setResetTarget] = React.useState<{ id: string; name: string; username: string; who: string } | null>(null)
  const [newCredential, setNewCredential] = React.useState<Credential | null>(null)

  const student = studentQ.data
  const current = React.useMemo(
    () => (enrollmentsQ.data ?? []).find((e) => e.is_active && e.status === "active") ?? null,
    [enrollmentsQ.data]
  )

  const back = (
    <Link href={`/${school}/students`} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
      ← Students
    </Link>
  )

  if (studentQ.isError) {
    return (
      <PageShell title="Student" eyebrow={back}>
        <EmptyState
          icon={UserRoundX}
          title={isNotFound(studentQ.error) ? "Student not found" : "Couldn't load this student"}
          description={
            isNotFound(studentQ.error)
              ? "This student isn't in this school, or the record was deleted. Go back to the directory and search again."
              : `${errorMessage(studentQ.error, "The server didn't answer.")} Check your connection and try again.`
          }
          action={
            isNotFound(studentQ.error) ? (
              <Button asChild>
                <Link href={`/${school}/students`}>Back to students</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => studentQ.refetch()}>
                Try again
              </Button>
            )
          }
        />
      </PageShell>
    )
  }

  if (!student) {
    return (
      <PageShell title={<Skeleton className="h-8 w-56" />} eyebrow={back}>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </PageShell>
    )
  }

  const name = fullName(student)
  const badge = studentStatusBadge(student.status)
  const isActive = student.status === "active"
  const canToggle = student.status === "active" || student.status === "inactive"
  const className = current ? enrollmentClassName(current) : enrollmentsQ.isLoading ? "" : "Not enrolled"

  const menu: DropdownMenuEntry[] = [
    {
      label: "Reset password",
      icon: KeyRound,
      onSelect: () => setResetTarget({ id: student.id, name, username: student.username || student.email || "", who: "student" }),
    },
  ]
  if (canToggle) {
    menu.push("separator", {
      label: isActive ? "Deactivate" : "Reactivate",
      icon: isActive ? UserX : UserCheck,
      destructive: isActive,
      onSelect: () => setConfirmStatus(true),
    })
  }

  const handleReset = async () => {
    if (!resetTarget) return
    try {
      const password = await resetPassword.mutateAsync(resetTarget.id)
      setNewCredential({ who: resetTarget.who, name: resetTarget.name, username: resetTarget.username, password })
    } catch (error) {
      notify.error(`${errorMessage(error, "The password wasn't reset.")} Try again.`)
      throw error
    }
  }

  const handleStatus = async () => {
    try {
      await setStatus.mutateAsync(isActive ? "inactive" : "active")
      notify.success(isActive ? `${name} is deactivated` : `${name} is active again`)
    } catch (error) {
      notify.error(`${errorMessage(error, "The status wasn't changed.")} Try again.`)
      throw error
    }
  }

  return (
    <PageShell
      eyebrow={back}
      title={name}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge status={badge.status} label={badge.label} />
          {[student.admission_number, student.username, className].filter(Boolean).map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              <span className="break-all">{part}</span>
            </React.Fragment>
          ))}
        </span>
      }
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" />
          Edit details
        </Button>
      }
      secondaryActions={
        <DropdownMenu
          label={`More actions for ${name}`}
          items={menu}
          trigger={
            <Button variant="outline" className="min-h-11 md:min-h-9">
              More actions
            </Button>
          }
        />
      }
      tabs={PROFILE_TABS.map((t) => ({
        label: t.label,
        href: `/${school}/students/${studentId}?tab=${t.key}`,
        active: t.key === tab,
      }))}
      tabsLabel="Student profile sections"
    >
      {tab === "overview" ? <OverviewTab student={student} current={current} /> : null}
      {tab === "enrollment" ? <EnrollmentTab studentId={studentId} school={school} /> : null}
      {tab === "attendance" ? <AttendanceTab studentId={studentId} school={school} /> : null}
      {tab === "results" ? <ResultsTab studentId={studentId} /> : null}
      {tab === "fees" ? <FeesTab school={school} /> : null}
      {tab === "guardians" ? (
        <GuardiansTab
          studentId={studentId}
          school={school}
          onResetPassword={(user) => setResetTarget({ ...user, who: "guardian" })}
        />
      ) : null}
      {tab === "id-card" ? <IdCardTab student={student} school={school} /> : null}

      <EditStudentSheet student={student} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null)
        }}
        title={`Reset the password for ${resetTarget?.name ?? ""}?`}
        description="Their current password stops working now. You get a new password to hand over, and they choose their own the next time they sign in."
        confirmLabel="Reset password"
        destructive
        onConfirm={handleReset}
      />

      <ConfirmDialog
        open={confirmStatus}
        onOpenChange={setConfirmStatus}
        title={isActive ? `Deactivate ${name}?` : `Reactivate ${name}?`}
        description={
          isActive
            ? "Their current class enrollment ends and they leave class lists and attendance. Their records are kept, and you can reactivate them later."
            : "They show as active again. Enroll them in a class from the Enrollment tab to put them back on a class list."
        }
        confirmLabel={isActive ? "Deactivate student" : "Reactivate student"}
        destructive={isActive}
        onConfirm={handleStatus}
      />

      <CredentialsDialog
        open={Boolean(newCredential)}
        onOpenChange={(open) => {
          if (!open) setNewCredential(null)
        }}
        title="New password"
        printTitle={`New password: ${newCredential?.name ?? ""}`}
        credentials={newCredential ? [newCredential] : []}
        description="This password is shown only once. Copy or print it now and hand it over. They choose a new password the first time they sign in."
      />
    </PageShell>
  )
}
