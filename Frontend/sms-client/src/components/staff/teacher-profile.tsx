"use client"

// Staff profile: header, tabs (?tab=overview | classes | sponsor) and the admin actions
// (edit details, reset password, deactivate / reactivate).

import * as React from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  KeyRound,
  Pencil,
  RefreshCw,
  School,
  UserCheck,
  UserX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/ui/page-shell"
import { DataTable } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, type DropdownMenuEntry } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { notify } from "@/components/ui/toaster"
import type { StaffClass, StaffMember, TeachingAssignment } from "@/services/api/staff-service"

import {
  useCurrentYear,
  useResetStaffPassword,
  useSponsoredClasses,
  useStaffMember,
  useTeachingAssignments,
  useUpdateStaffMember,
} from "./use-staff"
import { className, errorText, formatDate, fullName, staffStatus, statusCodeOf, type ProfileTab } from "./staff-format"
import { EditTeacherSheet } from "./edit-teacher-sheet"
import { NewPasswordDialog } from "./new-password-dialog"

export interface TeacherProfileProps {
  schoolSlug: string
  teacherId: string
  tab: ProfileTab
}

function TeacherProfile({ schoolSlug, teacherId, tab }: TeacherProfileProps) {
  const base = `/${schoolSlug}/teachers`
  const teacherQuery = useStaffMember(teacherId)
  const sponsored = useSponsoredClasses(teacherId)
  const { year } = useCurrentYear()
  const update = useUpdateStaffMember()
  const resetPassword = useResetStaffPassword()

  const [editOpen, setEditOpen] = React.useState(false)
  const [confirmReset, setConfirmReset] = React.useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState<string | null>(null)

  const backLink = (
    <Link href={base} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Staff
    </Link>
  )

  const teacher = teacherQuery.data

  if (!teacher) {
    if (teacherQuery.isError) {
      const notFound = statusCodeOf(teacherQuery.error) === 404 || statusCodeOf(teacherQuery.error) === 422
      return (
        <PageShell title={notFound ? "Teacher not found" : "Staff profile"} eyebrow={backLink}>
          <EmptyState
            icon={AlertTriangle}
            description={
              notFound
                ? "This teacher isn't on your school's staff list. They may have been removed. Go back to the directory to find them."
                : "We couldn't load this profile. Check your connection, then try again."
            }
            action={
              notFound ? (
                <Button asChild variant="outline">
                  <Link href={base}>Open the staff directory</Link>
                </Button>
              ) : (
                <Button variant="outline" onClick={() => teacherQuery.refetch()}>
                  <RefreshCw aria-hidden="true" />
                  Try again
                </Button>
              )
            }
          />
        </PageShell>
      )
    }
    return (
      <PageShell title={<Skeleton className="h-8 w-56" />} eyebrow={backLink}>
        <div className="space-y-3" aria-busy="true" aria-label="Loading profile">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-32 w-full max-w-2xl" />
        </div>
      </PageShell>
    )
  }

  const name = fullName(teacher)
  const status = staffStatus(teacher.status)
  const isActive = (teacher.status ?? "").toLowerCase() === "active"
  const currentSponsored = (sponsored.data ?? []).filter((c) => (year ? c.academic_year_id === year.id : c.is_active))

  const tabHref = (t: ProfileTab) => (t === "overview" ? `${base}/${teacherId}` : `${base}/${teacherId}?tab=${t}`)
  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: tab === "overview" },
    { label: "Classes and subjects", href: tabHref("classes"), active: tab === "classes" },
    { label: "Sponsor of", href: tabHref("sponsor"), active: tab === "sponsor" },
  ]

  const handleReset = async () => {
    try {
      const result = await resetPassword.mutateAsync(teacher.id)
      setNewPassword(result.generated_password)
    } catch (error) {
      notify.error(errorText(error, "We couldn't reset the password. Try again."))
      throw error
    }
  }

  const handleDeactivate = async () => {
    try {
      await update.mutateAsync({ id: teacher.id, data: { status: "inactive", is_active: false } })
      notify.success(`${name} was deactivated`)
    } catch (error) {
      notify.error(errorText(error, "We couldn't deactivate this teacher. Try again."))
      throw error
    }
  }

  const handleReactivate = async () => {
    try {
      await update.mutateAsync({ id: teacher.id, data: { status: "active", is_active: true } })
      notify.success(`${name} can sign in again`)
    } catch (error) {
      notify.error(errorText(error, "We couldn't reactivate this teacher. Try again."))
    }
  }

  const menuItems: DropdownMenuEntry[] = [
    { label: "Reset password", icon: KeyRound, onSelect: () => setConfirmReset(true) },
    "separator",
    isActive
      ? { label: "Deactivate", icon: UserX, destructive: true, onSelect: () => setConfirmDeactivate(true) }
      : { label: "Reactivate", icon: UserCheck, onSelect: handleReactivate, disabled: update.isPending },
  ]

  const subtitle = [
    teacher.employee_id ? `Employee ID ${teacher.employee_id}` : null,
    teacher.username ? `@${teacher.username}` : null,
    teacher.department || null,
  ].filter(Boolean)

  return (
    <PageShell
      eyebrow={backLink}
      title={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{name}</span>
          <StatusBadge status={status.status} label={status.label} size="md" />
        </span>
      }
      description={subtitle.join(" · ")}
      primaryAction={
        <Button className="min-h-11 md:min-h-9" onClick={() => setEditOpen(true)}>
          <Pencil aria-hidden="true" />
          Edit details
        </Button>
      }
      secondaryActions={
        <DropdownMenu
          items={menuItems}
          trigger={
            <Button variant="outline" className="min-h-11 md:min-h-9">
              More actions
            </Button>
          }
        />
      }
      tabs={tabs}
      tabsLabel="Profile sections"
    >
      {tab === "overview" ? <OverviewTab teacher={teacher} /> : null}
      {tab === "classes" ? <ClassesTab schoolSlug={schoolSlug} teacherId={teacher.id} /> : null}
      {tab === "sponsor" ? (
        <SponsorTab
          schoolSlug={schoolSlug}
          classes={sponsored.data ?? []}
          loading={sponsored.isLoading}
          error={sponsored.isError}
          onRetry={() => sponsored.refetch()}
          currentYearId={year?.id ?? null}
        />
      ) : null}

      <EditTeacherSheet teacher={teacher} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={`Reset the password for ${name}?`}
        description="Their current password stops working. You'll see the new one once, to hand over, and they'll choose their own when they next sign in."
        confirmLabel="Reset password"
        loading={resetPassword.isPending}
        onConfirm={handleReset}
      />

      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        destructive
        title={`Deactivate ${name}?`}
        description="They won't be able to sign in. Their classes, subjects and records stay as they are, and you can reactivate them later."
        confirmLabel="Deactivate teacher"
        loading={update.isPending}
        onConfirm={handleDeactivate}
      >
        {currentSponsored.length > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            They&apos;re still the sponsor of {currentSponsored.map(className).join(", ")}. Pick a new sponsor on the
            class page.
          </p>
        ) : null}
      </ConfirmDialog>

      <NewPasswordDialog
        open={newPassword !== null}
        onClose={() => setNewPassword(null)}
        name={name}
        username={teacher.username}
        email={teacher.email}
        password={newPassword}
      />
    </PageShell>
  )
}

/* ------------------------------------------------------------------ Overview */

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-base text-foreground md:text-sm">
        {value || <span className="text-muted-foreground">Not given</span>}
      </dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 md:p-6">
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function OverviewTab({ teacher }: { teacher: StaffMember }) {
  const address = [teacher.address, teacher.city, teacher.county, teacher.country].filter(Boolean).join(", ")
  const gender = teacher.gender ? teacher.gender.charAt(0).toUpperCase() + teacher.gender.slice(1) : null
  return (
    <div className="grid max-w-4xl gap-4">
      <Section title="Contact">
        <Detail label="Email" value={teacher.email} />
        <Detail label="Phone" value={teacher.phone_number} />
        {teacher.whatsapp_number ? <Detail label="WhatsApp" value={teacher.whatsapp_number} /> : null}
        <Detail label="Address" value={address} />
        <Detail label="Gender" value={gender} />
      </Section>
      <Section title="Work">
        <Detail label="Department" value={teacher.department} />
        <Detail label="Qualification" value={teacher.qualification} />
        <Detail label="Joining date" value={formatDate(teacher.joining_date)} />
        <Detail label="Employee ID" value={teacher.employee_id} />
        {teacher.exit_date ? <Detail label="Left on" value={formatDate(teacher.exit_date)} /> : null}
      </Section>
      <Section title="Sign-in">
        <Detail label="Username" value={teacher.username ? <span className="font-mono">{teacher.username}</span> : null} />
        <Detail
          label="Last signed in"
          value={teacher.last_login ? formatDate(teacher.last_login) : "Hasn't signed in yet"}
        />
      </Section>
    </div>
  )
}

/* ------------------------------------------------------- Classes and subjects */

interface TeachingRow extends TeachingAssignment {
  classLabel: string
}

function ClassesTab({ schoolSlug, teacherId }: { schoolSlug: string; teacherId: string }) {
  const { year, settled } = useCurrentYear()
  const [allYears, setAllYears] = React.useState(false)
  const yearId = allYears ? null : (year?.id ?? null)
  const query = useTeachingAssignments(teacherId, yearId, settled)
  const scopeId = React.useId()

  const rows = React.useMemo<TeachingRow[]>(
    () =>
      (query.data ?? []).map((a) => ({
        ...a,
        classLabel: a.name?.trim() || [a.grade_name, a.section_name].filter(Boolean).join(" ") || "Unnamed class",
      })),
    [query.data]
  )

  const classCount = new Set(rows.map((r) => r.class_id)).size

  const columns = React.useMemo<ColumnDef<TeachingRow>[]>(() => {
    const cols: ColumnDef<TeachingRow>[] = [
      {
        accessorKey: "classLabel",
        header: "Class",
        cell: ({ row }) => (
          <Link
            href={`/${schoolSlug}/classes/${row.original.class_id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.classLabel}
          </Link>
        ),
      },
      { accessorKey: "subject_name", header: "Subject", cell: ({ getValue }) => (getValue() as string) || "—" },
    ]
    if (allYears || !year) {
      cols.push({ accessorKey: "academic_year", header: "Year", cell: ({ getValue }) => (getValue() as string) || "—" })
    }
    return cols
  }, [schoolSlug, allYears, year])

  const assignLink = (
    <Button asChild variant="outline">
      <Link href={`/${schoolSlug}/academics/teacher-assignments`}>Assign subjects</Link>
    </Button>
  )

  if (query.isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        description="We couldn't load what this teacher teaches. Check your connection, then try again."
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {query.isLoading || !settled
            ? "Loading…"
            : rows.length === 0
              ? null
              : `${rows.length} ${rows.length === 1 ? "subject" : "subjects"} in ${classCount} ${classCount === 1 ? "class" : "classes"}`}
        </p>
        {year ? (
          <div className="flex items-center gap-2">
            <label htmlFor={scopeId} className="text-sm text-muted-foreground">
              Show
            </label>
            <select
              id={scopeId}
              value={allYears ? "all" : "current"}
              onChange={(e) => setAllYears(e.target.value === "all")}
              className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9 md:text-sm"
            >
              <option value="current">{year.name}</option>
              <option value="all">All years</option>
            </select>
          </div>
        ) : null}
      </div>
      <DataTable
        label="Classes and subjects"
        columns={columns}
        data={rows}
        loading={query.isLoading || !settled}
        pageSize={0}
        getRowId={(r) => r.id}
        initialSorting={[{ id: "classLabel", desc: false }]}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title="No subjects yet"
            description={
              year && !allYears
                ? `This teacher has no subjects in ${year.name}. Assign subjects to give them classes.`
                : "This teacher has no subjects. Assign subjects to give them classes."
            }
            action={assignLink}
          />
        }
      />
    </div>
  )
}

/* ---------------------------------------------------------------- Sponsor of */

interface SponsorTabProps {
  schoolSlug: string
  classes: StaffClass[]
  loading: boolean
  error: boolean
  onRetry: () => void
  currentYearId: string | null
}

function SponsorTab({ schoolSlug, classes, loading, error, onRetry, currentYearId }: SponsorTabProps) {
  const columns = React.useMemo<ColumnDef<StaffClass>[]>(
    () => [
      {
        id: "class",
        accessorFn: (c) => className(c),
        header: "Class",
        cell: ({ row }) => (
          <Link
            href={`/${schoolSlug}/classes/${row.original.id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {className(row.original)}
          </Link>
        ),
      },
      {
        id: "year",
        accessorFn: (c) => c.academic_year_name ?? "",
        header: "Year",
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-2">
            {row.original.academic_year_name || "—"}
            {currentYearId && row.original.academic_year_id === currentYearId ? (
              <StatusBadge status="info" label="This year" showIcon={false} />
            ) : null}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (c) => (c.is_active ? "Active" : "Inactive"),
        header: "Class status",
        cell: ({ row }) =>
          row.original.is_active ? (
            <StatusBadge status="success" label="Active" />
          ) : (
            <StatusBadge status="neutral" label="Inactive" />
          ),
      },
    ],
    [schoolSlug, currentYearId]
  )

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        description="We couldn't load the classes this teacher sponsors. Check your connection, then try again."
        action={
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    )
  }

  // Current year first, then newest years
  const sorted = [...classes].sort((a, b) => {
    const aCur = a.academic_year_id === currentYearId ? 0 : 1
    const bCur = b.academic_year_id === currentYearId ? 0 : 1
    if (aCur !== bCur) return aCur - bCur
    return (b.academic_year_name ?? "").localeCompare(a.academic_year_name ?? "") || className(a).localeCompare(className(b))
  })

  return (
    <DataTable
      label="Classes this teacher sponsors"
      columns={columns}
      data={sorted}
      loading={loading}
      pageSize={0}
      getRowId={(c) => c.id}
      emptyState={
        <EmptyState
          icon={School}
          title="Not a sponsor"
          description="This teacher doesn't sponsor any class. Choose a class's sponsor on its class page."
          action={
            <Button asChild variant="outline">
              <Link href={`/${schoolSlug}/classes`}>Open classes</Link>
            </Button>
          }
        />
      }
    />
  )
}

export { TeacherProfile }
