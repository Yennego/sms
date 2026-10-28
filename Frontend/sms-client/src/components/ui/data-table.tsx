"use client"

// DataTable: TanStack Table with client-side search, sorting and pagination.
// Desk (>= 768px): a normal table. Phone (< 768px): each row becomes a card, so the page never
// scrolls sideways. Both layouts are rendered and switched with CSS (no hydration mismatch).
//
// Column options via `meta` (typed as DataTableColumnMeta):
//   meta: { label: "Class", hideOnMobile: true, className: "text-right" }

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

export interface DataTableColumnMeta {
  /** Label used in phone cards and for sort buttons when `header` isn't a string. */
  label?: string
  /** Leave this column out of the default phone card. */
  hideOnMobile?: boolean
  /** Extra classes for header and cells (e.g. "text-right"). */
  className?: string
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Accessible name for the table, e.g. "Students". */
  label: string
  loading?: boolean
  /** Number of skeleton rows while loading. */
  loadingRows?: number
  /** Shown when there is no data. Defaults to a generic EmptyState. */
  emptyState?: React.ReactNode
  /** Show a search box that filters all columns. */
  searchable?: boolean
  searchPlaceholder?: string
  /** Rows per page. Pass 0 to disable pagination. */
  pageSize?: number
  initialSorting?: SortingState
  onRowClick?: (row: TData) => void
  /** Custom phone card. Falls back to label / value pairs from the columns. */
  mobileCard?: (row: TData) => React.ReactNode
  getRowId?: (row: TData, index: number) => string
  /** Content placed next to the search box (e.g. a filter button). */
  toolbar?: React.ReactNode
  className?: string
}

function getMeta<TData>(cell: Pick<Cell<TData, unknown>, "column">): DataTableColumnMeta {
  return (cell.column.columnDef.meta as DataTableColumnMeta | undefined) ?? {}
}

function columnLabel<TData>(column: Cell<TData, unknown>["column"]): string {
  const meta = (column.columnDef.meta as DataTableColumnMeta | undefined) ?? {}
  if (meta.label) return meta.label
  const header = column.columnDef.header
  return typeof header === "string" ? header : column.id
}

function DataTable<TData, TValue>({
  columns,
  data,
  label,
  loading = false,
  loadingRows = 5,
  emptyState,
  searchable = false,
  searchPlaceholder = "Search",
  pageSize = 20,
  initialSorting = [],
  onRowClick,
  mobileCard,
  getRowId,
  toolbar,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = React.useState("")
  const paginated = pageSize > 0
  const searchId = React.useId()

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginated ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: paginated ? { pagination: { pageIndex: 0, pageSize } } : undefined,
  })

  const rows = table.getRowModel().rows
  const filteredCount = table.getFilteredRowModel().rows.length
  const isEmpty = !loading && rows.length === 0
  const isFiltered = globalFilter.trim().length > 0

  const rowInteraction = (row: Row<TData>) =>
    onRowClick
      ? {
          tabIndex: 0,
          onClick: () => onRowClick(row.original),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.target !== e.currentTarget) return
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onRowClick(row.original)
            }
          },
        }
      : {}

  const emptyContent = isFiltered ? (
    <EmptyState
      icon={Search}
      description={`Nothing matches "${globalFilter}". Try a different search.`}
      action={
        <Button variant="outline" onClick={() => setGlobalFilter("")}>
          Clear search
        </Button>
      }
    />
  ) : (
    (emptyState ?? <EmptyState description="Nothing here yet." />)
  )

  return (
    <div data-slot="data-table" className={cn("flex min-w-0 flex-col gap-4", className)}>
      {searchable || toolbar ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {searchable ? (
            <div className="relative w-full sm:max-w-xs">
              <label htmlFor={searchId} className="sr-only">
                {searchPlaceholder}
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={searchId}
                type="search"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 pl-9 md:h-9"
              />
            </div>
          ) : null}
          {toolbar ? <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div> : null}
        </div>
      ) : null}

      {isEmpty ? (
        emptyContent
      ) : (
        <>
          {/* Desk table */}
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full caption-bottom text-sm" aria-label={label} aria-busy={loading || undefined}>
              <thead className="bg-muted/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b">
                    {headerGroup.headers.map((header) => {
                      const meta = getMeta(header)
                      const canSort = header.column.getCanSort()
                      const sorted = header.column.getIsSorted()
                      const content = header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                          }
                          className={cn(
                            "h-11 px-4 text-left align-middle font-medium whitespace-nowrap text-muted-foreground",
                            meta.className
                          )}
                        >
                          {canSort && !header.isPlaceholder ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="-ml-2 inline-flex h-9 items-center gap-1 rounded-md px-2 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            >
                              {content}
                              {sorted === "asc" ? (
                                <ArrowUp className="size-3.5" aria-hidden="true" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="size-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            content
                          )}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: loadingRows }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="border-b last:border-0">
                        {table.getVisibleLeafColumns().map((col) => (
                          <td key={col.id} className="px-4 py-3">
                            <Skeleton className="h-4 w-full max-w-40" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map((row) => (
                      <tr
                        key={row.id}
                        {...rowInteraction(row)}
                        className={cn(
                          "border-b transition-colors last:border-0",
                          onRowClick &&
                            "cursor-pointer outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className={cn("px-4 py-3 align-middle", getMeta(cell).className)}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="flex flex-col gap-3 md:hidden" aria-label={label} aria-busy={loading || undefined}>
            {loading
              ? Array.from({ length: Math.min(loadingRows, 3) }).map((_, i) => (
                  <li key={`skeleton-${i}`} className="space-y-2 rounded-xl border p-4">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </li>
                ))
              : rows.map((row) => (
                  <li
                    key={row.id}
                    {...rowInteraction(row)}
                    className={cn(
                      "rounded-xl border bg-card p-4 text-card-foreground",
                      onRowClick &&
                        "min-h-11 cursor-pointer outline-none active:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    )}
                  >
                    {mobileCard ? (
                      mobileCard(row.original)
                    ) : (
                      <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm">
                        {row
                          .getVisibleCells()
                          .filter((cell) => !getMeta(cell).hideOnMobile)
                          .map((cell) => (
                            <React.Fragment key={cell.id}>
                              <dt className="text-muted-foreground">{columnLabel(cell.column)}</dt>
                              <dd className="min-w-0 break-words text-foreground">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </dd>
                            </React.Fragment>
                          ))}
                      </dl>
                    )}
                  </li>
                ))}
          </ul>
        </>
      )}

      {!loading && (paginated || isFiltered) && filteredCount > 0 ? (
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite">
            {filteredCount === 1 ? "1 result" : `${filteredCount} results`}
            {paginated && table.getPageCount() > 1
              ? ` · Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`
              : null}
          </p>
          {paginated && table.getPageCount() > 1 ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>
              <Button
                variant="outline"
                className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export { DataTable }
