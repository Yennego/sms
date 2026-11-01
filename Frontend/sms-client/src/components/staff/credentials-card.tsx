"use client"

// Sign-in details shown once after adding a teacher or resetting a password, with copy buttons.

import * as React from "react"
import { Check, Copy, KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { notify } from "@/components/ui/toaster"

export interface CredentialItem {
  label: string
  value: string
}

function CopyButton({ label, value, text = "Copy" }: CredentialItem & { text?: string }) {
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      notify.error("Couldn't copy. Select the text and copy it yourself.")
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 shrink-0 sm:min-h-9"
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : text}
    </Button>
  )
}

export interface CredentialsCardProps {
  items: CredentialItem[]
  /** Shown under the values, e.g. that the password is shown only once. */
  note?: React.ReactNode
}

function CredentialsCard({ items, note }: CredentialsCardProps) {
  const all = items.map((i) => `${i.label}: ${i.value}`).join("\n")
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <KeyRound className="size-4" aria-hidden="true" />
        Sign-in details
      </div>
      <dl className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="font-mono text-base break-all text-foreground select-all">{item.value}</dd>
            </div>
            <CopyButton label={item.label} value={item.value} />
          </div>
        ))}
      </dl>
      {items.length > 1 ? (
        <div className="mt-3">
          <CopyButton label="All details" value={all} text="Copy all" />
        </div>
      ) : null}
      {note ? <p className="mt-3 text-sm text-muted-foreground">{note}</p> : null}
    </div>
  )
}

export { CredentialsCard }
