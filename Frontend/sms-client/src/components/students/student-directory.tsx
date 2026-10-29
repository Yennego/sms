"use client"

// Students directory: every student of the school with search, class and status filters.
// Desk: a table; phone: cards (DataTable switches by itself). Row → student profile.

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { FileSpreadsheet, GraduationCap, RefreshCw, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { PageShell } from "@/components/ui/page-shell"
import { StatusBadge } from "@/components/ui/status-badge"
import type { StudentEnrollment, StudentRecord } from "@/services/api/student-records-service"
import {
  classIdOfEnrollment,
  enrollmentClassName,
  errorMessage,
  fullName,
  STUDENT_STATUSES,
  studentStatusBadge,
  yearClassName,
} from "./format"
import { useCurrentEnrollments, useCurrentYearClasses, useDirectoryStudents } from "./queries"

interface DirectoryRow {
  id: string
  name: string
  username: string
  admissionNumber: string
  classId: string | null
  className: string
  status: string
}

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto md:h-9"

function buildRows(
  students: StudentRecord[],
  enrollments: Record<string, StudentEnrollment | null> | undefined,
  classes: ReturnType<typeof useCurrentYearClasses>["classes"]
): DirectoryRow[] {
  return students.map((s) => {
    const e = enrollments?.[s.id] ?? null
    const classId = classIdOfEnrollment(e, classes)
    const cls = classId ? classes.find((c) => c.id === classId) : undefined
    return {
      id: s.id,
      name: fullName(s),
      username: s.username || s.email || "",
      admissionNumber: s.admission_number || "",
      classId,
      className: cls ? yearClassName(cls) : enrollmentClassName(e),
      status: s.status || "active",
    }
  })
}

export function StudentDirectory({ school }: { school: string }) {
  const router = useRouter()
  const students = useDirectoryStudents()
  const ids = React.useMemo(() => (students.data ?? []).map((s) => s.id), [students.data])
  const enrollments = useCurrentEnrollments(ids)
  const { classes } = useCurrentYearClasses()

  const [classFilter, setClassFilter] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("active")

  const rows = React.useMemo(
    () => buildRows(students.data ?? [], enrollments.data, classes),
    [students.data, enrollments.data, classes]
  )

  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (!statusFilter || r.status === statusFilter) &&
          (!classFilter || (classFilter === "none" ? !r.className : r.classId === classFilter))
      ),
    [rows, statusFilter, classFilter]
  )

  const sortedClasses = React.useMemo(
    () => [...classes].sort((a, b) => yearClassName(a).localeCompare(yearClassName(b), undefined, { numeric: true })),
    [classes]
  )

  const classPending = enrollments.isLoading && ids.length > 0

  const columns = React.useMemo<ColumnDef<DirectoryRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      { accessorKey: "username", header: "Username", meta: { hideOnMobile: true } },
      { accessorKey: "admissionNumber", header: "Admission no." },
      {
        accessorKey: "className",
        header: "Class",
        cell: ({ row }) =>
          row.original.className ? (
            row.original.className
          ) : (
            <span className="text-muted-foreground">{classPending ? "Loading…" : "Not enrolled"}</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const b = studentStatusBadge(row.original.status)
          return <StatusBadge status={b.status} label={b.label} />
        },
      },
    ],
    [classPending]
  )

  const hasFilters = Boolean(classFilter || statusFilter)
  const total = students.data?.length ?? 0

  return (
    <PageShell
      title="Students"
      description={
        students.data
          ? `${total === 1 ? "1 student" : `${total} students`} in this school.`
          : "Everyone who is or was a student at this school."
      }
      primaryAction={
        <Button asChild className="min-h-11 md:min-h-9">
          <Link href={`/${school}/students/new`}>
            <UserPlus aria-hidden="true" />
            Admit a student
          </Link>
        </Button>
      }
      secondaryActions={
        <Button asChild variant="outline" className="min-h-11 md:min-h-9">
          <Link href={`/${school}/students/import`}>
            <FileSpreadsheet aria-hidden="true" />
            Import from a spreadsheet
          </Link>
        </Button>
      }
    >
      {students.isError ? (
        <EmptyState
          icon={RefreshCw}
          title="Couldn't load students"
          description={`${errorMessage(students.error, "The server didn't answer.")} Check your connection and try again.`}
          action={
            <Button variant="outline" onClick={() => students.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <DataTable
          label="Students"
          columns={columns}
          data={filtered}
          loading={students.isLoading}
          searchable
          searchPlaceholder="Search by name, username or admission no."
          getRowId={(r) => r.id}
          initialSorting={[{ id: "name", desc: false }]}
          onRowClick={(r) => router.push(`/${school}/students/${r.id}`)}
          mobileCard={(r) => {
            const b = studentStatusBadge(r.status)
            return (
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium break-words text-foreground">{r.name}</p>
                  <StatusBadge status={b.status} label={b.label} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {[r.admissionNumber, r.className || (classPending ? "" : "Not enrolled")].filter(Boolean).join(" · ")}
                </p>
                {r.username ? <p className="text-sm break-all text-muted-foreground">{r.username}</p> : null}
              </div>
            )
          }}
          toolbar={
            <>
              <label className="sr-only" htmlFor="students-class-filter">
                Class
              </label>
              <select
                id="students-class-filter"
                className={selectClass}
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All classes</option>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {yearClassName(c)}
                  </option>
                ))}
                <option value="none">Not enrolled</option>
              </select>
              <label className="sr-only" htmlFor="students-status-filter">
                Status
              </label>
              <select
                id="students-status-filter"
                className={selectClass}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {studentStatusBadge(s).label}
                  </option>
                ))}
              </select>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 md:min-h-9"
                  onClick={() => {
                    setClassFilter("")
                    setStatusFilter("")
                  }}
                >
                  Show everyone
                </Button>
              ) : null}
            </>
          }
          emptyState={
            total === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No students yet"
                description="Admit your first student, or import a class list from a spreadsheet."
                action={
                  <Button asChild>
                    <Link href={`/${school}/students/new`}>Admit a student</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                description="No students match these filters. Pick another class or status."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setClassFilter("")
                      setStatusFilter("")
                    }}
                  >
                    Show everyone
                  </Button>
                }
              />
            )
          }
        />
      )}
    </PageShell>
  )
}
