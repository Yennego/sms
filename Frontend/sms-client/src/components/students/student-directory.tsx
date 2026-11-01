"use client"

// Students directory: the school's students, one server page at a time (roster endpoint), with
// search, class and status filters and sort. The view (filters, search, sort, page, page size)
// lives in the URL. Desk: a table; phone: cards (DataTable switches by itself). Row → profile.

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { FileSpreadsheet, GraduationCap, RefreshCw, Search, UserPlus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { PageShell } from "@/components/ui/page-shell"
import { Pagination } from "@/components/ui/pagination"
import { StatusBadge } from "@/components/ui/status-badge"
import { className as classLabel, useRoster, useYearClasses } from "@/components/class-placement/queries"
import {
  isRosterSort,
  LabeledSelect,
  PAGE_SIZES,
  SearchBox,
  SORT_OPTIONS,
} from "@/components/class-placement/roster-controls"
import { positiveInt, useDebouncedSearch, useUrlState } from "@/components/class-placement/use-url-state"
import type { RosterParams, RosterStudent } from "@/services/api/class-placement-service"
import { errorMessage, STUDENT_STATUSES, studentStatusBadge } from "./format"

interface DirectoryRow {
  id: string
  name: string
  username: string
  admissionNumber: string
  className: string
  status: string
}

// status: "active" (default) | "all" (everyone) | another student status.
// class: "" (all classes) | a class id | "none" (not enrolled this year).
const URL_DEFAULTS = { q: "", class: "", status: "active", sort: "name", page: "1", size: "25" }

const count = new Intl.NumberFormat("en-US")

function toRow(s: RosterStudent): DirectoryRow {
  return {
    id: s.student_id,
    name: s.name || [s.first_name, s.last_name].filter(Boolean).join(" ") || "Unnamed",
    username: s.username || s.email || "",
    admissionNumber: s.admission_number || "",
    className: s.enrollment ? s.enrollment.class_name || "Unnamed class" : "",
    status: s.student_status || "active",
  }
}

function DirectoryView({ school }: { school: string }) {
  const router = useRouter()
  const [url, setUrl] = useUrlState(URL_DEFAULTS)
  const sort = isRosterSort(url.sort) ? url.sort : "name"
  const pageSize = positiveInt(url.size, 25, PAGE_SIZES)
  const page = positiveInt(url.page, 1)
  const statusFilter = url.status === "all" ? "" : url.status
  const classFilter = url.class

  const commitSearch = React.useCallback((q: string) => setUrl({ q, page: null }), [setUrl])
  const [searchText, setSearchText] = useDebouncedSearch(url.q, commitSearch)

  const params = React.useMemo<RosterParams>(
    () => ({
      placement: classFilter === "none" ? "unplaced" : "all",
      classId: classFilter && classFilter !== "none" ? classFilter : undefined,
      // The server defaults to active; an empty string asks for everyone.
      studentStatus: statusFilter === "active" ? undefined : statusFilter,
      q: url.q || undefined,
      sort,
      page,
      pageSize,
    }),
    [classFilter, statusFilter, url.q, sort, page, pageSize]
  )

  const roster = useRoster(params)
  const data = roster.data
  const classesQuery = useYearClasses(data?.academic_year?.id)
  const classes = classesQuery.data ?? []

  // A page past the end: go to the last page.
  React.useEffect(() => {
    if (!data || roster.isPlaceholderData) return
    if (data.items.length === 0 && page > 1) setUrl({ page: data.pages > 1 ? data.pages : null })
  }, [data, roster.isPlaceholderData, page, setUrl])

  const rows = React.useMemo(() => (data?.items ?? []).map(toRow), [data])

  const columns = React.useMemo<ColumnDef<DirectoryRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      { accessorKey: "username", header: "Username", enableSorting: false, meta: { hideOnMobile: true } },
      { accessorKey: "admissionNumber", header: "Admission no.", enableSorting: false },
      {
        accessorKey: "className",
        header: "Class",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.className ? (
            row.original.className
          ) : (
            <span className="text-muted-foreground">Not enrolled</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => {
          const b = studentStatusBadge(row.original.status)
          return <StatusBadge status={b.status} label={b.label} />
        },
      },
    ],
    []
  )

  const showEveryone = () => {
    setSearchText("")
    setUrl({ q: null, class: null, status: "all", page: null })
  }

  const hasFilters = Boolean(classFilter || url.status !== "all" || url.q)
  const noYear = roster.isError && (roster.error as { statusCode?: number })?.statusCode === 404
  const nothingAtAll = Boolean(
    data && data.counts.all === 0 && !url.q && !classFilter && (statusFilter === "" || statusFilter === "active")
  )
  const statusWord = statusFilter ? `${studentStatusBadge(statusFilter).label.toLowerCase()} ` : ""

  return (
    <PageShell
      title="Students"
      description={
        data && !url.q
          ? `${count.format(data.counts.all)} ${statusWord}${data.counts.all === 1 ? "student" : "students"}${data.academic_year ? ` · school year ${data.academic_year.name}` : " · no current school year"}.`
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
      {roster.isError ? (
        <EmptyState
          icon={RefreshCw}
          title={noYear ? "No current school year" : "Couldn't load students"}
          description={
            noYear
              ? "The student list shows each student's class for the current school year. Set the current school year first."
              : `${errorMessage(roster.error, "The server didn't answer.")} Check your connection and try again.`
          }
          action={
            noYear ? undefined : (
              <Button variant="outline" onClick={() => roster.refetch()}>
                Try again
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchBox
              value={searchText}
              onChange={setSearchText}
              placeholder="Search by name, username or admission no."
            />
            <LabeledSelect label="Class" value={classFilter} onChange={(v) => setUrl({ class: v, page: null })}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
              <option value="none">Not enrolled</option>
            </LabeledSelect>
            <LabeledSelect
              label="Status"
              value={url.status}
              onChange={(v) => setUrl({ status: v, page: null })}
            >
              <option value="all">All statuses</option>
              {STUDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {studentStatusBadge(s).label}
                </option>
              ))}
            </LabeledSelect>
            <LabeledSelect
              label="Sort by"
              hideLabel={false}
              value={sort}
              onChange={(v) => setUrl({ sort: v, page: null })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </LabeledSelect>
            {hasFilters ? (
              <Button type="button" variant="ghost" className="min-h-11 md:min-h-9" onClick={showEveryone}>
                Show everyone
              </Button>
            ) : null}
          </div>

          <div
            aria-busy={roster.isFetching || undefined}
            className={cn("flex flex-col gap-4 transition-opacity", roster.isPlaceholderData && "opacity-60")}
          >
            <DataTable
              label="Students"
              columns={columns}
              data={rows}
              loading={roster.isLoading || (!data && roster.isFetching)}
              loadingRows={Math.min(pageSize, 10)}
              pageSize={0}
              getRowId={(r) => r.id}
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
                      {[r.admissionNumber, r.className || "Not enrolled"].filter(Boolean).join(" · ")}
                    </p>
                    {r.username ? <p className="text-sm break-all text-muted-foreground">{r.username}</p> : null}
                  </div>
                )
              }}
              emptyState={
                nothingAtAll ? (
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
                    icon={Search}
                    description={
                      url.q
                        ? `Nothing matches "${url.q}". Try another search, class or status.`
                        : "No students match these filters. Pick another class or status."
                    }
                    action={
                      <Button variant="outline" onClick={showEveryone}>
                        Show everyone
                      </Button>
                    }
                  />
                )
              }
            />

            {data && data.total > 0 ? (
              <Pagination
                label="Student pages"
                itemLabel="students"
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPageChange={(p) => setUrl({ page: p })}
                onPageSizeChange={(size) => setUrl({ size, page: null })}
                pageSizeOptions={PAGE_SIZES}
              />
            ) : null}
          </div>
        </>
      )}
    </PageShell>
  )
}

export function StudentDirectory({ school }: { school: string }) {
  // The view is read from the URL query, which needs a Suspense boundary in the App Router.
  return (
    <React.Suspense fallback={null}>
      <DirectoryView school={school} />
    </React.Suspense>
  )
}
