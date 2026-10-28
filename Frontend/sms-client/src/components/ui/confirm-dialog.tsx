"use client"

// ConfirmDialog: replaces window.confirm.
// Built on Headless UI v2 Dialog because @radix-ui/react-alert-dialog is not installed.
// The props follow the shadcn AlertDialog shape (open / onOpenChange), so the internals can be
// swapped to Radix later without touching callers.

import * as React from "react"
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A question, e.g. "Delete 3 students?" */
  title: React.ReactNode
  /** What will be lost, e.g. "Their enrollments will also be deleted. This can't be undone." */
  description?: React.ReactNode
  /** Says what happens, e.g. "Delete students". Never "OK". */
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  /** External loading flag (e.g. a mutation's isPending). Combined with the internal pending state. */
  loading?: boolean
  /**
   * Called on confirm. If it returns a promise the dialog shows a spinner and closes when it
   * resolves. If it throws or rejects the dialog stays open (show the error with a toast).
   */
  onConfirm: () => void | Promise<void>
  /** Optional extra content between description and buttons (e.g. a list of affected items). */
  children?: React.ReactNode
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false)
  const busy = pending || loading

  const handleClose = React.useCallback(() => {
    if (!busy) onOpenChange(false)
  }, [busy, onOpenChange])

  const handleConfirm = async () => {
    try {
      setPending(true)
      await onConfirm()
      onOpenChange(false)
    } catch {
      // Keep the dialog open; the caller is responsible for reporting the error.
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} role="alertdialog" className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel
          transition
          aria-busy={busy || undefined}
          className={cn(
            "w-full max-w-md rounded-xl border bg-background p-6 text-left shadow-xl",
            "transition duration-200 ease-out data-[closed]:translate-y-4 data-[closed]:opacity-0 sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95"
          )}
        >
          <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
          {description ? (
            <Description className="mt-2 text-sm text-muted-foreground">{description}</Description>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              onClick={handleClose}
              disabled={busy}
              // Safer default focus for destructive confirmations.
              autoFocus={destructive}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              className="min-h-11 sm:min-h-9"
              onClick={handleConfirm}
              disabled={busy}
              autoFocus={!destructive}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export { ConfirmDialog }
