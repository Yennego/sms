"use client"

// One-time sign-in details (new admissions, imports, password resets). Shown once: the admin
// copies or prints them to hand over; the user must change the password at first sign-in.

import * as React from "react"
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react"
import { Check, Copy, Download, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { notify } from "@/components/ui/toaster"
import { capitalize } from "./format"

export interface Credential {
  who: string
  name: string
  username: string
  password: string
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers / insecure origins
    try {
      const el = document.createElement("textarea")
      el.value = text
      el.setAttribute("readonly", "")
      el.style.position = "fixed"
      el.style.opacity = "0"
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)
}

/** Opens a plain, app-chrome-free page with one slip per account and prints it. */
export function printCredentials(title: string, credentials: Credential[], signInUrl?: string) {
  const win = window.open("", "_blank", "width=800,height=900")
  if (!win) {
    notify.error("Your browser blocked the print window. Allow pop-ups for this site and try again.")
    return
  }
  const slips = credentials
    .map(
      (c) => `<section class="slip">
  <p class="who">${escapeHtml(capitalize(c.who))}</p>
  <h2>${escapeHtml(c.name)}</h2>
  <dl><dt>Username</dt><dd>${escapeHtml(c.username)}</dd><dt>Password</dt><dd>${escapeHtml(c.password)}</dd></dl>
  ${signInUrl ? `<p class="hint">Sign in at ${escapeHtml(signInUrl)}</p>` : ""}
  <p class="hint">You will be asked to choose a new password the first time you sign in.</p>
</section>`
    )
    .join("")
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin:24px;color:#0f172a}
  h1{font-size:20px;margin:0 0 16px}
  .slip{border:1px dashed #94a3b8;border-radius:8px;padding:16px;margin:0 0 16px;break-inside:avoid}
  .who{margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
  h2{font-size:18px;margin:4px 0 12px}
  dl{display:grid;grid-template-columns:110px 1fr;gap:6px 12px;margin:0;font-size:16px}
  dt{color:#475569} dd{margin:0;font-family:ui-monospace,Consolas,monospace;font-weight:600}
  .hint{font-size:12px;color:#475569;margin:10px 0 0}
  @page{size:A4;margin:12mm}
</style></head><body><h1>${escapeHtml(title)}</h1>${slips}</body></html>`)
  win.document.close()
  win.focus()
  // Let the new document lay out before printing.
  setTimeout(() => win.print(), 250)
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function downloadCredentialsCsv(filename: string, credentials: Credential[]) {
  const lines = [
    ["who", "name", "username", "password"].join(","),
    ...credentials.map((c) => [c.who, c.name, c.username, c.password].map(csvCell).join(",")),
  ]
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 md:size-9"
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      onClick={async () => {
        const ok = await copyText(value)
        if (ok) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } else {
          notify.error("Couldn't copy. Select the text and copy it yourself.")
        }
      }}
    >
      {copied ? <Check className="text-green-700" aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  )
}

/** The list of accounts with copy buttons. */
export function CredentialsList({ credentials }: { credentials: Credential[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {credentials.map((c, i) => (
        <li key={`${c.username}-${i}`} className="rounded-xl border p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{capitalize(c.who)}</p>
          <p className="text-base font-semibold break-words text-foreground">{c.name}</p>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Username</dt>
                <dd className="font-mono font-semibold break-all">{c.username}</dd>
              </div>
              <CopyButton value={c.username} label="Username" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Password</dt>
                <dd className="font-mono font-semibold break-all">{c.password}</dd>
              </div>
              <CopyButton value={c.password} label="Password" />
            </div>
          </dl>
        </li>
      ))}
    </ul>
  )
}

export interface CredentialsActionsProps {
  title: string
  credentials: Credential[]
  csvFilename?: string
}

/** Print (and optionally CSV) buttons for a set of credentials. */
export function CredentialsActions({ title, credentials, csvFilename }: CredentialsActionsProps) {
  const signInUrl =
    typeof window !== "undefined" ? `${window.location.origin}/${window.location.pathname.split("/")[1]}/login` : undefined
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 md:min-h-9"
        onClick={() => printCredentials(title, credentials, signInUrl)}
      >
        <Printer aria-hidden="true" />
        Print sign-in slips
      </Button>
      {csvFilename ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 md:min-h-9"
          onClick={() => downloadCredentialsCsv(csvFilename, credentials)}
        >
          <Download aria-hidden="true" />
          Download as CSV
        </Button>
      ) : null}
    </div>
  )
}

export interface CredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  printTitle: string
  credentials: Credential[]
  /** Next steps, e.g. "Admit another" / "Open student profile". Defaults to a "Done" button. */
  actions?: React.ReactNode
}

/** Shows one-time passwords. Closing needs an explicit button so they aren't lost by a stray tap. */
export function CredentialsDialog({
  open,
  onOpenChange,
  title,
  description,
  printTitle,
  credentials,
  actions,
}: CredentialsDialogProps) {
  return (
    <Dialog open={open} onClose={() => undefined} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-200 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel
          transition
          className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border bg-background shadow-xl transition duration-200 ease-out data-[closed]:translate-y-4 data-[closed]:opacity-0"
        >
          <div className="border-b p-6 pb-4">
            <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
            <Description className="mt-1 text-sm text-muted-foreground">
              {description ??
                "These passwords are shown only once. Copy or print them now and hand them over. Each person chooses a new password the first time they sign in."}
            </Description>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {credentials.length > 0 ? (
              <CredentialsList credentials={credentials} />
            ) : (
              <p className="text-sm text-muted-foreground">No new accounts were created, so there are no passwords to hand over.</p>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:flex-wrap sm:justify-between">
            {credentials.length > 0 ? <CredentialsActions title={printTitle} credentials={credentials} /> : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row [&>*]:min-h-11 md:[&>*]:min-h-9">
              {actions ?? (
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              )}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
