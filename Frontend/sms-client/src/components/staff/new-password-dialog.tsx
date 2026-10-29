"use client"

// Shows a freshly issued password once, after an admin reset.

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

import { CredentialsCard, type CredentialItem } from "./credentials-card"

export interface NewPasswordDialogProps {
  open: boolean
  onClose: () => void
  name: string
  username?: string | null
  email?: string | null
  password: string | null
}

function NewPasswordDialog({ open, onClose, name, username, email, password }: NewPasswordDialogProps) {
  const items: CredentialItem[] = []
  if (username) items.push({ label: "Username", value: username })
  else if (email) items.push({ label: "Email", value: email })
  if (password) items.push({ label: "New password", value: password })

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-md bg-background">
        <DialogTitle className="text-lg font-semibold text-foreground">New password for {name}</DialogTitle>
        <DialogDescription className="mt-2">
          Hand this over now: it won&apos;t be shown again. They&apos;ll choose their own password when they next
          sign in.
        </DialogDescription>
        <div className="mt-4">
          <CredentialsCard items={items} />
        </div>
        <div className="mt-6 flex justify-end">
          <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { NewPasswordDialog }
