"use client"

// Sheet: a side or bottom panel (phone "More" menu, filters, quick edit).
// Built on Headless UI v2 Dialog because @radix-ui/react-dialog is not installed.
// The API mirrors shadcn's Sheet (open / onOpenChange / side) so the internals can be
// swapped to Radix later without touching callers.

import * as React from "react"
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

export type SheetSide = "left" | "right" | "bottom"

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  side?: SheetSide
  /** Sticky footer, e.g. "Apply filters" / "Clear" buttons. */
  footer?: React.ReactNode
  /** Visually hide the title (it is still read by screen readers). */
  hideTitle?: boolean
  closeLabel?: string
  className?: string
  children?: React.ReactNode
}

const sideClasses: Record<SheetSide, string> = {
  left: "inset-y-0 left-0 h-full w-[85vw] max-w-sm border-r data-[closed]:-translate-x-full",
  right: "inset-y-0 right-0 h-full w-[85vw] max-w-sm border-l data-[closed]:translate-x-full",
  bottom:
    "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] data-[closed]:translate-y-full",
}

function Sheet({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  footer,
  hideTitle = false,
  closeLabel = "Close",
  className,
  children,
}: SheetProps) {
  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />
      <DialogPanel
        transition
        data-side={side}
        className={cn(
          "fixed flex flex-col bg-background shadow-xl transition-transform duration-300 ease-out",
          sideClasses[side],
          className
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b px-4 py-2">
          <div className={cn("min-w-0 py-2", hideTitle && "sr-only")}>
            <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
            {description ? (
              <Description className="mt-1 text-sm text-muted-foreground">{description}</Description>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">{closeLabel}</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end [&>*]:min-h-11">
            {footer}
          </div>
        ) : null}
      </DialogPanel>
    </Dialog>
  )
}

export { Sheet }
