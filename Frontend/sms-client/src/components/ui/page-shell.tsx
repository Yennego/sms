// PageShell and PageHeader: the one page layout from the design brief (section 4).
// Title, optional description, primary action in the same place on every page,
// optional secondary actions and an optional link tab bar.

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

export interface PageTab {
  label: string
  href: string
  active?: boolean
}

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary action (usually one Button). Rendered last so it sits on the right on desk and full width on phones. */
  primaryAction?: React.ReactNode
  /** Secondary actions (e.g. an outline Button or a DropdownMenu). */
  secondaryActions?: React.ReactNode
  /** Optional content above the title, e.g. a back link or breadcrumb. */
  eyebrow?: React.ReactNode
  className?: string
}

function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  eyebrow,
  className,
}: PageHeaderProps) {
  const hasActions = Boolean(primaryAction || secondaryActions)
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? <div className="text-sm text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-base text-muted-foreground md:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {hasActions ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center md:shrink-0 md:justify-end [&>*]:min-h-11 sm:[&>*]:min-h-0">
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </header>
  )
}

export interface PageTabsProps {
  tabs: PageTab[]
  /** Accessible name for the tab navigation. */
  label?: string
  className?: string
}

/** Link-based tab bar. Each tab is a real link (works without JS, supports open-in-new-tab). Scrolls sideways on phones. */
function PageTabs({ tabs, label = "Page sections", className }: PageTabsProps) {
  return (
    <nav aria-label={label} className={cn("-mx-4 border-b md:mx-0", className)}>
      <ul className="flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <li key={tab.href} className="shrink-0">
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium outline-none transition-colors",
                "focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50",
                tab.active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export interface PageShellProps extends PageHeaderProps {
  tabs?: PageTab[]
  tabsLabel?: string
  children?: React.ReactNode
  /** Classes for the outer container. */
  className?: string
  /** Classes for the content area under the header and tabs. */
  contentClassName?: string
}

function PageShell({
  title,
  description,
  primaryAction,
  secondaryActions,
  eyebrow,
  tabs,
  tabsLabel,
  children,
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8", className)}
    >
      <PageHeader
        title={title}
        description={description}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        eyebrow={eyebrow}
      />
      {tabs && tabs.length > 0 ? <PageTabs tabs={tabs} label={tabsLabel} /> : null}
      <div className={cn("flex min-w-0 flex-col gap-6", contentClassName)}>{children}</div>
    </div>
  )
}

export { PageShell, PageHeader, PageTabs }
