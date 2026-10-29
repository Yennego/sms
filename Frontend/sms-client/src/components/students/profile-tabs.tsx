"use client"

// The tab panels of the student profile. Each reads one existing endpoint.

import * as React from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { BookOpen, CalendarCheck, IdCard, KeyRound, Loader2, Phone, Receipt, RefreshCw, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge"
import { notify } from "@/components/ui/toaster"
import type { GuardianRecord, PublishedGrade, StudentEnrollment, StudentRecord } from "@/services/api/student-records-service"
import type { DailyStatus } from "@/types/daily-attendance"
import {
  capitalize,
  enrollmentClassName,
  errorMessage,
  formatDate,
  formatTime,
  fullName,
  isoDay,
} from "./format"
import {
  useCurrentYear,
  useReissueIdCard,
  useStudentAttendance,
  useStudentEnrollments,
  useStudentGrades,
  useStudentGuardians,
} from "./queries"

function LoadError({ error, onRetry, what }: { error: unknown; onRetry: () => void; what: string }) {
  return (
    <EmptyState
      icon={RefreshCw}
      title={`Couldn't load ${what}`}
      description={`${errorMessage(error, "The server didn't answer.")} Check your connection and try again.`}
      action={
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base break-words text-foreground md:text-sm">{value || <span className="text-muted-foreground">Not recorded</span>}</dd>
    </div>
  )
}

// --- Overview -------------------------------------------------------------------------------

export function OverviewTab({ student, current }: { student: StudentRecord; current?: StudentEnrollment | null }) {
  const year = useCurrentYear()
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border p-4 md:p-6">
        <h2 className="text-base font-semibold">Personal details</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="First name" value={student.first_name} />
          <Detail label="Last name" value={student.last_name} />
          <Detail label="Gender" value={student.gender ? capitalize(student.gender) : ""} />
          <Detail label="Date of birth" value={formatDate(student.date_of_birth)} />
          <Detail label="Home address" value={student.address} />
          <Detail label="Phone number" value={student.phone_number} />
        </dl>
      </section>
      <section className="rounded-xl border p-4 md:p-6">
        <h2 className="text-base font-semibold">School record</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Admission number" value={student.admission_number} />
          <Detail label="Admission date" value={formatDate(student.admission_date)} />
          <Detail label="Username" value={student.username} />
          <Detail label="Email" value={student.email} />
          <Detail label="Class" value={current ? enrollmentClassName(current) : "Not enrolled"} />
          <Detail label="School year" value={current?.academic_year || year.data?.name} />
        </dl>
      </section>
    </div>
  )
}

// --- Enrollment -----------------------------------------------------------------------------

function enrollmentBadge(e: StudentEnrollment): { status: StatusBadgeStatus; label: string } {
  if (e.is_active && e.status === "active") return { status: "success", label: "Current" }
  switch (e.status) {
    case "promoted":
      return { status: "info", label: "Promoted" }
    case "graduated":
      return { status: "info", label: "Graduated" }
    case "transferred":
    case "withdrawn":
      return { status: "warning", label: capitalize(e.status) }
    default:
      return { status: "neutral", label: e.is_active ? capitalize(e.status) : "Ended" }
  }
}

export function EnrollmentTab({ studentId, school }: { studentId: string; school: string }) {
  const q = useStudentEnrollments(studentId)
  const columns = React.useMemo<ColumnDef<StudentEnrollment>[]>(
    () => [
      { id: "year", header: "School year", accessorFn: (e) => e.academic_year ?? "" },
      { id: "class", header: "Class", accessorFn: (e) => enrollmentClassName(e) },
      {
        id: "date",
        header: "Enrolled on",
        accessorFn: (e) => e.enrollment_date ?? "",
        cell: ({ row }) => formatDate(row.original.enrollment_date),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (e) => e.status,
        cell: ({ row }) => {
          const b = enrollmentBadge(row.original)
          return <StatusBadge status={b.status} label={b.label} />
        },
      },
    ],
    []
  )
  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} what="enrollments" />
  return (
    <DataTable
      label="Enrollment history"
      columns={columns}
      data={q.data ?? []}
      loading={q.isLoading}
      pageSize={0}
      getRowId={(e) => e.id}
      initialSorting={[{ id: "date", desc: true }]}
      emptyState={
        <EmptyState
          icon={BookOpen}
          title="Not enrolled in any class"
          description="Place the student in a class of the current year to start their record."
          action={
            <Button asChild>
              <Link href={`/${school}/academics/enrollments`}>Enroll in a class</Link>
            </Button>
          }
        />
      }
    />
  )
}

// --- Attendance -----------------------------------------------------------------------------

const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This school year" },
] as const

function dailyBadge(status: DailyStatus): StatusBadgeStatus {
  return status === "tardy" ? "late" : status
}

export function AttendanceTab({ studentId, school }: { studentId: string; school: string }) {
  const year = useCurrentYear()
  const [range, setRange] = React.useState<(typeof RANGES)[number]["value"]>("30")
  const today = new Date()
  const end = isoDay(today)
  const start = React.useMemo(() => {
    if (range === "year" && year.data?.start_date) return year.data.start_date.slice(0, 10)
    const d = new Date()
    d.setDate(d.getDate() - (range === "90" ? 90 : 30))
    return isoDay(d)
  }, [range, year.data?.start_date])

  const q = useStudentAttendance(studentId, start, end)
  const s = q.data?.summary
  const records = React.useMemo(
    () => [...(q.data?.records ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [q.data?.records]
  )

  const tiles: { label: string; value: React.ReactNode }[] = s
    ? [
        { label: "Attendance", value: s.attendance_rate == null ? "–" : `${Math.round(s.attendance_rate)}%` },
        { label: "Present", value: s.present },
        { label: "Late", value: s.late },
        { label: "Absent", value: s.absent },
        { label: "Excused or sick", value: s.excused + s.sick },
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              type="button"
              variant={range === r.value ? "default" : "outline"}
              aria-pressed={range === r.value}
              className="min-h-11 md:min-h-9"
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
        <Button asChild variant="link" className="min-h-11 justify-start px-0 md:min-h-9">
          <Link href={`/${school}/attendance/students/${studentId}`}>Open full attendance record</Link>
        </Button>
      </div>

      {q.isError ? (
        <LoadError error={q.error} onRetry={() => q.refetch()} what="attendance" />
      ) : q.isLoading ? (
        <ListSkeleton />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {formatDate(q.data?.start_date ?? start)} to {formatDate(q.data?.end_date ?? end)}
            {s ? ` · ${s.school_days} school days` : ""}
          </p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border p-4">
                <dt className="text-sm text-muted-foreground">{t.label}</dt>
                <dd className="text-2xl font-semibold text-foreground">{t.value}</dd>
              </div>
            ))}
          </dl>
          {records.length === 0 ? (
            <EmptyState icon={CalendarCheck} description="No attendance was marked for this student in this period." />
          ) : (
            <ul className="divide-y rounded-xl border" aria-label="Attendance by day">
              {records.map((r) => (
                <li key={r.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="text-sm font-medium">{formatDate(r.date)}</span>
                  <span className="flex items-center gap-3 text-sm text-muted-foreground">
                    {r.check_in_at ? <span>In {formatTime(r.check_in_at)}</span> : null}
                    <StatusBadge status={dailyBadge(r.status)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// --- Results --------------------------------------------------------------------------------

export function ResultsTab({ studentId }: { studentId: string }) {
  const q = useStudentGrades(studentId)
  const bySubject = React.useMemo(() => {
    const map = new Map<string, { name: string; grades: PublishedGrade[] }>()
    for (const g of q.data ?? []) {
      if (g.is_published === false) continue
      const key = g.subject_id
      const entry = map.get(key) ?? { name: g.subject_name || "Subject", grades: [] }
      entry.grades.push(g)
      map.set(key, entry)
    }
    return [...map.values()]
      .map((e) => ({ ...e, grades: e.grades.sort((a, b) => b.assessment_date.localeCompare(a.assessment_date)) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [q.data])

  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} what="results" />
  if (q.isLoading) return <ListSkeleton />
  if (bySubject.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No published results yet"
        description="Results appear here once teachers enter marks and the school publishes them."
      />
    )
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {bySubject.map((subject) => {
        const avg = subject.grades.reduce((sum, g) => sum + g.percentage, 0) / subject.grades.length
        return (
          <section key={subject.name} className="rounded-xl border">
            <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="font-semibold">{subject.name}</h2>
              <span className="text-sm text-muted-foreground">Average {Math.round(avg)}%</span>
            </header>
            <ul className="divide-y">
              {subject.grades.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium break-words">{g.assessment_name}</span>
                    <span className="text-muted-foreground">
                      {formatDate(g.assessment_date)}
                      {g.period_number ? ` · Period ${g.period_number}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium">
                      {g.score} / {g.max_score}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round(g.percentage)}%{g.letter_grade ? ` · ${g.letter_grade}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// --- Fees -----------------------------------------------------------------------------------

export function FeesTab({ school }: { school: string }) {
  return (
    <EmptyState
      icon={Receipt}
      title="Fees for one student aren't shown here yet"
      description="Look up this student's invoices and payments in the Fees area for now."
      action={
        <Button asChild variant="outline">
          <Link href={`/${school}/finance/fees`}>Open fees</Link>
        </Button>
      }
    />
  )
}

// --- Guardians ------------------------------------------------------------------------------

export function GuardiansTab({
  studentId,
  school,
  onResetPassword,
}: {
  studentId: string
  school: string
  onResetPassword: (user: { id: string; name: string; username: string }) => void
}) {
  const q = useStudentGuardians(studentId)
  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} what="guardians" />
  if (q.isLoading) return <ListSkeleton />
  const guardians = q.data ?? []
  if (guardians.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No guardian linked"
        description="Add a guardian so a parent can sign in and follow this student."
        action={
          <Button asChild variant="outline">
            <Link href={`/${school}/students/new`}>Admit with a guardian</Link>
          </Button>
        }
      />
    )
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {guardians.map((g: GuardianRecord) => {
        const name = fullName(g)
        const phone = g.phone_number || g.whatsapp_number
        return (
          <li key={g.id} className="flex flex-col gap-3 rounded-xl border p-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {capitalize(g.relationship_type || "guardian")}
              </p>
              <p className="text-base font-semibold break-words">{name}</p>
            </div>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Username</dt>
                <dd className="break-all">{g.username || "None"}</dd>
              </div>
              {g.email ? (
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all">{g.email}</dd>
                </div>
              ) : null}
            </dl>
            <div className="flex flex-col gap-2 sm:flex-row [&>*]:min-h-11 md:[&>*]:min-h-9">
              {phone ? (
                <Button asChild variant="outline">
                  <a href={`tel:${phone.replace(/\s+/g, "")}`}>
                    <Phone aria-hidden="true" />
                    Call {phone}
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => onResetPassword({ id: g.id, name, username: g.username || g.email || "" })}
              >
                <KeyRound aria-hidden="true" />
                Reset password
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// --- ID card --------------------------------------------------------------------------------

export function IdCardTab({ student, school }: { student: StudentRecord; school: string }) {
  const reissue = useReissueIdCard()
  const [confirm, setConfirm] = React.useState(false)
  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-xl border p-4 md:p-6">
      <div className="flex gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <IdCard className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Student ID card</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The card carries a QR code the gate scans for attendance. Print cards for a whole class from the ID cards page.
            If a card is lost, issue a new one: the old card stops working.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row [&>*]:min-h-11 md:[&>*]:min-h-9">
        <Button asChild>
          <Link href={`/${school}/attendance/id-cards`}>Open ID cards</Link>
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirm(true)} disabled={reissue.isPending}>
          {reissue.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Issue a new card
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Issue a new card for ${fullName(student)}?`}
        description="The current card stops working at the gate straight away. Print the new card from the ID cards page."
        confirmLabel="Issue new card"
        destructive
        onConfirm={async () => {
          try {
            const card = await reissue.mutateAsync(student.id)
            notify.success(`New card issued (version ${card.card_version}). Print it from the ID cards page.`)
          } catch (error) {
            notify.error(`${errorMessage(error, "The card wasn't reissued.")} Try again.`)
            throw error
          }
        }}
      />
    </section>
  )
}
