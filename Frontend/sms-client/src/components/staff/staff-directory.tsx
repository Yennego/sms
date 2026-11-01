"use client"

// Staff directory: every teacher in the school with search, department and status filters.
// Row (or card) opens the teacher's profile.

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle, Plus, RefreshCw, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/ui/page-shell"
import { DataTable } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import type { StaffClass, StaffMember } from "@/services/api/staff-service"

import { useStaffDepartments, useStaffList, useYearClasses } from "./use-staff"
import { className, fullName, staffStatus } from "./staff-format"

interface DirectoryRow extends StaffMember {
  name: string
  sponsorOf: string
}

const ALL = "all"
const NO_DEPARTMENT = "__none__"

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto md:h-9 md:text-sm"

export interface StaffDirectoryProps {
  schoolSlug: string
}

function StaffDirectory({ schoolSlug }: StaffDirectoryProps) {
  const router = useRouter()
  const staff = useStaffList()
  const departments = useStaffDepartments()
  const classes = useYearClasses()
  const [department, setDepartment] = React.useState(ALL)
  const [status, setStatus] = React.useState(ALL)
  const departmentId = React.useId()
  const statusId = React.useId()

  const base = `/${schoolSlug}/teachers`

  const sponsorMap = React.useMemo(() => {
    const map = new Map<string, StaffClass[]>()
    for (const c of classes.data ?? []) {
      if (!c.class_teacher_id) continue
      const list = map.get(c.class_teacher_id) ?? []
      list.push(c)
      map.set(c.class_teacher_id, list)
    }
    return map
  }, [classes.data])

  const rows = React.useMemo<DirectoryRow[]>(() => {
    return (staff.data ?? [])
      .filter((t) => {
        if (department === NO_DEPARTMENT) return !t.department?.trim()
        if (department !== ALL) return (t.department ?? "").trim() === department
        return true
      })
      .filter((t) => status === ALL || (t.status ?? "").toLowerCase() === status)
      .map((t) => ({
        ...t,
        name: fullName(t),
        sponsorOf: (sponsorMap.get(t.id) ?? []).map(className).join(", "),
      }))
  }, [staff.data, department, status, sponsorMap])

  const departmentOptions = React.useMemo(() => {
    const fromApi = departments.data ?? []
    if (fromApi.length > 0) return fromApi
    // Fall back to the departments in the list if the departments call fails
    return [...new Set((staff.data ?? []).map((t) => t.department?.trim()).filter((d): d is string => !!d))].sort()
  }, [departments.data, staff.data])

  const columns = React.useMemo<ColumnDef<DirectoryRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`${base}/${row.original.id}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.name}
            </Link>
            {row.original.email ? (
              <div className="truncate text-xs text-muted-foreground">{row.original.email}</div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "username",
        header: "Username",
        cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string | null) || "—"}</span>,
      },
      { accessorKey: "employee_id", header: "Employee ID" },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ getValue }) => (getValue() as string | null) || <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "sponsorOf",
        header: "Sponsor of",
        cell: ({ getValue }) =>
          (getValue() as string) || <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = staffStatus(getValue() as string)
          return <StatusBadge status={s.status} label={s.label} />
        },
      },
    ],
    [base]
  )

  const mobileCard = (row: DirectoryRow) => {
    const s = staffStatus(row.status)
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <span className="font-medium text-foreground">{row.name}</span>
          <StatusBadge status={s.status} label={s.label} />
        </div>
        <p className="text-sm text-muted-foreground">
          {[row.employee_id, row.username ? `@${row.username}` : null].filter(Boolean).join(" · ")}
        </p>
        {row.department ? <p className="text-sm text-foreground">{row.department}</p> : null}
        {row.sponsorOf ? <p className="text-sm text-foreground">Sponsor of {row.sponsorOf}</p> : null}
      </div>
    )
  }

  const addButton = (
    <Button asChild className="min-h-11 md:min-h-9">
      <Link href={`${base}/new`}>
        <Plus aria-hidden="true" />
        Add a teacher
      </Link>
    </Button>
  )

  const filtersActive = department !== ALL || status !== ALL
  const hasStaff = (staff.data?.length ?? 0) > 0

  let content: React.ReactNode
  if (staff.isError && !staff.data) {
    content = (
      <EmptyState
        icon={AlertTriangle}
        title="We couldn't load your staff"
        description="Check your connection, then try again."
        action={
          <Button variant="outline" onClick={() => staff.refetch()}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    )
  } else {
    content = (
      <DataTable
        label="Teachers"
        columns={columns}
        data={rows}
        loading={staff.isLoading}
        searchable
        searchPlaceholder="Search by name, username or employee ID"
        getRowId={(row) => row.id}
        onRowClick={(row) => router.push(`${base}/${row.id}`)}
        mobileCard={mobileCard}
        initialSorting={[{ id: "name", desc: false }]}
        toolbar={
          hasStaff ? (
            <>
              <label htmlFor={departmentId} className="sr-only">
                Department
              </label>
              <select
                id={departmentId}
                className={selectClass}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value={ALL}>All departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value={NO_DEPARTMENT}>No department</option>
              </select>
              <label htmlFor={statusId} className="sr-only">
                Status
              </label>
              <select id={statusId} className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value={ALL}>All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="retired">Retired</option>
                <option value="resigned">Resigned</option>
              </select>
            </>
          ) : undefined
        }
        emptyState={
          filtersActive && hasStaff ? (
            <EmptyState
              icon={Users}
              description="No teachers match these filters."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setDepartment(ALL)
                    setStatus(ALL)
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No teachers yet"
              description="Add your first teacher. You'll get their username and password to hand over."
              action={addButton}
            />
          )
        }
      />
    )
  }

  return (
    <PageShell
      title="Staff"
      description="Teachers at your school, what they teach and the classes they sponsor."
      primaryAction={addButton}
    >
      {classes.isError ? (
        <p className="text-sm text-muted-foreground" role="status">
          Class sponsors couldn&apos;t be loaded, so &ldquo;Sponsor of&rdquo; may be empty. Reload the page to try again.
        </p>
      ) : null}
      {content}
    </PageShell>
  )
}

export { StaffDirectory }
