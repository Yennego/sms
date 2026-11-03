"use client"

// The school's Users page: everyone at this school (students, parents, teachers, staff), searched
// and paged on the server, with "Reset password" for the office and "Add staff member" for new staff
// sign-ins. New passwords are shown once to hand over in person; they are never emailed.

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"
import { AlertTriangle, KeyRound, RefreshCw, Search, UserPlus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { PageShell } from "@/components/ui/page-shell"
import { Pagination } from "@/components/ui/pagination"
import { StatusBadge } from "@/components/ui/status-badge"
import { notify } from "@/components/ui/toaster"
import { NewPasswordDialog } from "@/components/staff/new-password-dialog"
import { CredentialsDialog } from "@/components/students/credentials"
import { errorMessage } from "@/components/students/format"
import { useTenant } from "@/hooks/use-tenant"
import {
  useUserDirectoryService,
  type DirectoryUser,
  type OfficeResetResult,
  type StaffAccountCreated,
} from "@/services/api/user-directory-service"

import { AddStaffSheet } from "./add-staff-sheet"
import { roleLabel } from "./role-labels"

const STATUSES = ["all", "active", "inactive"] as const

// Built-in roles, in the order the office looks for them
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
  { value: "teacher", label: "Teachers" },
  { value: "admin", label: "Admins" },
  { value: "academic-admin", label: "Academic admins" },
  { value: "registrar", label: "Registrars" },
  { value: "accountant", label: "Accountants" },
  { value: "financial-admin", label: "Financial admins" },
  { value: "counselor", label: "Counselors" },
  { value: "attendance-scanner", label: "Gate scanners" },
]

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-auto md:h-9 md:text-sm"

function rolesText(roles: string[]): string {
  return roles.map(roleLabel).join(", ") || "No role"
}

function statusCode(error: unknown): number | undefined {
  return error && typeof error === "object" ? (error as { statusCode?: number }).statusCode : undefined
}

function UsersScreen() {
  const service = useUserDirectoryService()
  const { tenantKey } = useTenant()
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""))
  const [role, setRole] = useQueryState("role", parseAsString.withDefault(""))
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(STATUSES).withDefault("all"))
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1))
  const [pageSize, setPageSize] = useQueryState("size", parseAsInteger.withDefault(25))
  const [search, setSearch] = React.useState(q)
  const [target, setTarget] = React.useState<DirectoryUser | null>(null)
  const [issued, setIssued] = React.useState<(OfficeResetResult & { name: string }) | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [created, setCreated] = React.useState<StaffAccountCreated | null>(null)
  const roleId = React.useId()
  const statusId = React.useId()

  // Search after typing stops, from the first page
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      if (search.trim() !== q) {
        void setQ(search.trim() || null)
        void setPage(null)
      }
    }, 350)
    return () => window.clearTimeout(t)
  }, [search, q, setQ, setPage])

  const users = useQuery({
    queryKey: ["users", tenantKey, "directory", { q, role, status, page, pageSize }],
    queryFn: () => service.list({ q, role, status, page, page_size: pageSize }),
    enabled: Boolean(tenantKey),
    placeholderData: keepPreviousData,
  })

  const reset = useMutation({ mutationFn: (userId: string) => service.resetPassword(userId) })

  const handleReset = async () => {
    if (!target) return
    try {
      const result = await reset.mutateAsync(target.id)
      setIssued({ ...result, name: target.name })
      void users.refetch()
    } catch (error) {
      notify.error(`${errorMessage(error, "The password wasn't reset.")} Try again.`)
      throw error
    }
  }

  const columns = React.useMemo<ColumnDef<DirectoryUser>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium text-foreground">{row.original.name || "—"}</div>
            {row.original.email ? <div className="truncate text-xs text-muted-foreground">{row.original.email}</div> : null}
          </div>
        ),
      },
      {
        accessorKey: "username",
        header: "Username",
        cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string | null) || "—"}</span>,
      },
      { id: "roles", header: "Role", cell: ({ row }) => rolesText(row.original.roles) },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <StatusBadge
              status={row.original.is_active ? "success" : "neutral"}
              label={row.original.is_active ? "Active" : "Inactive"}
            />
            {row.original.must_change_password ? <StatusBadge status="info" label="New password issued" /> : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={() => setTarget(row.original)}>
            <KeyRound aria-hidden="true" />
            Reset password
          </Button>
        ),
        meta: { className: "text-right" },
      },
    ],
    []
  )

  const mobileCard = (row: DirectoryUser) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 font-medium text-foreground">{row.name || "—"}</span>
        <StatusBadge status={row.is_active ? "success" : "neutral"} label={row.is_active ? "Active" : "Inactive"} />
      </div>
      <p className="text-sm text-muted-foreground break-all">
        {[rolesText(row.roles), row.username ? `@${row.username}` : null, row.email].filter(Boolean).join(" · ")}
      </p>
      {row.must_change_password ? <p className="text-sm text-muted-foreground">New password issued, not changed yet.</p> : null}
      <Button variant="outline" className="min-h-11 w-full" onClick={() => setTarget(row)}>
        <KeyRound aria-hidden="true" />
        Reset password
      </Button>
    </div>
  )

  const filtersActive = Boolean(q || role || status !== "all")
  const data = users.data

  const forbidden = users.isError && !data && statusCode(users.error) === 403

  let content: React.ReactNode
  if (users.isError && !data) {
    content = (
      <EmptyState
        icon={AlertTriangle}
        title={forbidden ? "Not available for your role" : "We couldn't load the users"}
        description={
          forbidden
            ? "Ask a school admin if you need to manage users or reset passwords."
            : `${errorMessage(users.error, "The server didn't answer.")} Check your connection and try again.`
        }
        action={
          forbidden ? undefined : (
            <Button variant="outline" onClick={() => users.refetch()}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          )
        }
      />
    )
  } else {
    content = (
      <>
        <DataTable
          label="Users"
          columns={columns}
          data={data?.items ?? []}
          loading={users.isLoading}
          getRowId={(row) => row.id}
          mobileCard={mobileCard}
          emptyState={
            <EmptyState
              icon={Users}
              description={filtersActive ? "No one matches this search or these filters." : "No users yet."}
              action={
                filtersActive ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("")
                      void setQ(null)
                      void setRole(null)
                      void setStatus(null)
                      void setPage(null)
                    }}
                  >
                    Clear search and filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
        {data && data.total > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={(p) => void setPage(p)}
            onPageSizeChange={(s) => {
              void setPageSize(s)
              void setPage(null)
            }}
            itemLabel="users"
            disabled={users.isFetching}
          />
        ) : null}
      </>
    )
  }

  return (
    <PageShell
      title="Users"
      description="Everyone at your school. Add staff sign-ins, or reset a password when someone can't sign in."
      primaryAction={
        forbidden ? undefined : (
          <Button className="min-h-11 w-full sm:w-auto md:min-h-9" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden="true" />
            Add staff member
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username, email or phone"
            aria-label="Search users"
            className="h-11 pl-9 md:h-9"
          />
        </div>
        <label htmlFor={roleId} className="sr-only">
          Role
        </label>
        <select
          id={roleId}
          className={selectClass}
          value={role}
          onChange={(e) => {
            void setRole(e.target.value || null)
            void setPage(null)
          }}
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <label htmlFor={statusId} className="sr-only">
          Status
        </label>
        <select
          id={statusId}
          className={selectClass}
          value={status}
          onChange={(e) => {
            void setStatus(e.target.value === "all" ? null : (e.target.value as (typeof STATUSES)[number]))
            void setPage(null)
          }}
        >
          <option value="all">Active and inactive</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {content}

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
        title={`Reset the password for ${target?.name ?? ""}?`}
        description="Their current password stops working now and they are signed out everywhere. You get a new password to hand over in person, and they choose their own the next time they sign in."
        confirmLabel="Reset password"
        destructive
        loading={reset.isPending}
        onConfirm={handleReset}
      />

      <NewPasswordDialog
        open={Boolean(issued)}
        onClose={() => setIssued(null)}
        name={issued?.name ?? ""}
        username={issued?.username}
        email={issued?.email}
        password={issued?.generated_password ?? null}
      />

      <AddStaffSheet
        open={adding}
        onOpenChange={setAdding}
        onCreated={(account) => {
          setCreated(account)
          void users.refetch()
        }}
      />

      <CredentialsDialog
        open={Boolean(created)}
        onOpenChange={(open) => {
          if (!open) setCreated(null)
        }}
        title={`Account created for ${created?.name ?? ""}`}
        description="This password is shown only once. Copy or print it now and hand it over. They choose a new password the first time they sign in."
        printTitle="New staff sign-in"
        credentials={created?.credentials ?? []}
      />
    </PageShell>
  )
}

export { UsersScreen }
