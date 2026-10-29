"use client"

// Pagination for server-paged lists: "Showing 26–50 of 312", previous / next, page numbers with
// ellipses (desk) and a page size select. Every control is at least 44 px tall on phones.

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface PaginationProps {
  /** Current page, from 1. */
  page: number
  pageSize: number
  /** Total number of items across all pages. */
  total: number
  onPageChange: (page: number) => void
  /** Show a page size select when given. */
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: readonly number[]
  /** Accessible name of the nav landmark, e.g. "Student pages". */
  label?: string
  /** Word for the items in the summary, e.g. "students". */
  itemLabel?: string
  /** Disable the controls (e.g. while a page is loading). */
  disabled?: boolean
  className?: string
}

const numberFormat = new Intl.NumberFormat("en-US")

/** Page numbers to show: first, last, the current page and its neighbours, with gaps as "…". */
export function pageItems(page: number, pages: number, siblings = 1): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const start = Math.max(2, page - siblings)
  const end = Math.min(pages - 1, page + siblings)
  const items: (number | "gap")[] = [1]
  if (start > 2) items.push(start === 3 ? 2 : "gap")
  for (let p = start; p <= end; p++) items.push(p)
  if (end < pages - 1) items.push(end === pages - 2 ? pages - 1 : "gap")
  items.push(pages)
  return items
}

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  label = "Pages",
  itemLabel,
  disabled = false,
  className,
}: PaginationProps) {
  const sizeId = React.useId()
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const current = Math.min(Math.max(1, page), pages)
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1
  const last = Math.min(total, current * pageSize)

  const summary =
    total === 0
      ? `No ${itemLabel ?? "results"}`
      : `Showing ${numberFormat.format(first)}–${numberFormat.format(last)} of ${numberFormat.format(total)}${
          itemLabel ? ` ${itemLabel}` : ""
        }`

  const go = (p: number) => {
    if (!disabled && p >= 1 && p <= pages && p !== current) onPageChange(p)
  }

  return (
    <nav
      aria-label={label}
      data-slot="pagination"
      className={cn(
        "flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p aria-live="polite">{summary}</p>
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor={sizeId}>Rows per page</label>
            <select
              id={sizeId}
              value={pageSize}
              disabled={disabled}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-11 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 sm:flex-none md:min-h-9"
            onClick={() => go(current - 1)}
            disabled={disabled || current <= 1}
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>

          {/* Phone: just the position. Desk: page numbers. */}
          <span className="px-2 whitespace-nowrap sm:hidden">
            Page {current} of {pages}
          </span>
          <ul className="hidden items-center gap-1 sm:flex">
            {pageItems(current, pages).map((item, i) =>
              item === "gap" ? (
                <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
                  …
                </li>
              ) : (
                <li key={item}>
                  <Button
                    type="button"
                    variant={item === current ? "default" : "ghost"}
                    className="min-h-11 min-w-11 px-2 md:min-h-9 md:min-w-9"
                    aria-current={item === current ? "page" : undefined}
                    aria-label={`Page ${item}`}
                    onClick={() => go(item)}
                    disabled={disabled && item !== current}
                  >
                    {item}
                  </Button>
                </li>
              )
            )}
          </ul>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 sm:flex-none md:min-h-9"
            onClick={() => go(current + 1)}
            disabled={disabled || current >= pages}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </nav>
  )
}

export { Pagination }
