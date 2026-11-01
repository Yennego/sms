// EmptyState: shown when a list or page has nothing yet. One sentence that says
// what to do next, plus an optional primary action (design brief: "show the next step").

import * as React from "react"
import { Inbox, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon
  /** Optional short heading, e.g. "No students yet". */
  title?: React.ReactNode
  /** One sentence telling the user what to do next. */
  description: React.ReactNode
  /** Primary action, usually a Button (or Button asChild with a Link). */
  action?: React.ReactNode
  /** Remove the dashed border (e.g. when inside a Card). */
  bare?: boolean
}

function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  bare = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        !bare && "rounded-xl border border-dashed",
        className
      )}
      {...props}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2 [&>*]:min-h-11">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
