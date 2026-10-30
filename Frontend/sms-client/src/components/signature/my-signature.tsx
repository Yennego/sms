"use client"

// "My signature": the signed-in person's signature, printed on the report cards they sign as
// class sponsor or principal (phase4-design.md section 6). Two ways to set it: draw it (finger on
// a phone, mouse on a desk) or upload a photo or scan. Only the owner can set or remove it.

import * as React from "react"
import { Eraser, Loader2, PenLine, RefreshCw, Trash2, Undo2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { PageShell } from "@/components/ui/page-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { notify } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

import { errorText } from "./errors"
import { ImagePicker, type PickedImage } from "./image-picker"
import { useMySignature, useRemoveMySignature, useSaveMySignature } from "./queries"
import { SignaturePad, type SignaturePadHandle } from "./signature-pad"

type Mode = "draw" | "upload"

function formatUpdated(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

export function MySignature() {
  const query = useMySignature()
  const save = useSaveMySignature()
  const remove = useRemoveMySignature()

  const [mode, setMode] = React.useState<Mode>("draw")
  const padRef = React.useRef<SignaturePadHandle>(null)
  const [strokes, setStrokes] = React.useState(0)
  const [picked, setPicked] = React.useState<PickedImage | null>(null)
  const [confirmRemove, setConfirmRemove] = React.useState(false)

  const current = query.data
  const updated = formatUpdated(current?.updated_at ?? null)
  const canSave = mode === "draw" ? strokes > 0 : Boolean(picked)

  const onSave = async () => {
    let file: Blob | null = null
    let filename = "signature.png"
    if (mode === "draw") {
      file = (await padRef.current?.toBlob()) ?? null
      if (!file) {
        notify.error("Sign in the box first, then save.")
        return
      }
    } else if (picked) {
      file = picked.file
      filename = picked.filename
    }
    if (!file) return
    try {
      await save.mutateAsync({ file, filename })
      notify.success("Signature saved. It will be printed on report cards published from now on.")
      if (mode === "draw") padRef.current?.clear()
      setPicked(null)
    } catch (error) {
      notify.error(`${errorText(error, "The signature wasn't saved.")} Try again.`)
    }
  }

  return (
    <PageShell
      title="My signature"
      description="Your signature is printed on the report cards you sign as class sponsor or principal. Only you can change it."
      className="max-w-3xl"
    >
      {/* Current signature */}
      <section className="rounded-xl border p-4 md:p-6" aria-labelledby="current-signature">
        <h2 id="current-signature" className="text-base font-semibold">
          Your signature now
        </h2>
        {query.isLoading ? (
          <Skeleton className="mt-4 h-32 w-full rounded-xl" />
        ) : query.isError ? (
          <EmptyState
            className="mt-4"
            icon={RefreshCw}
            title="Couldn't load your signature"
            description={`${errorText(query.error, "The server didn't answer.")} Check your connection and try again.`}
            action={
              <Button variant="outline" onClick={() => query.refetch()}>
                Try again
              </Button>
            }
          />
        ) : current?.has_signature && current.image ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex h-32 items-center justify-center rounded-xl border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the server */}
              <img src={current.image} alt="Your signature" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{updated ? `Saved ${updated}.` : "Saved."} Set a new one below to replace it.</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 text-destructive"
                onClick={() => setConfirmRemove(true)}
                disabled={remove.isPending}
              >
                <Trash2 aria-hidden="true" />
                Remove signature
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            You haven&rsquo;t added a signature yet. Report cards show a blank line where you sign until you do.
          </p>
        )}
      </section>

      {/* Set a signature */}
      <section className="rounded-xl border p-4 md:p-6" aria-labelledby="set-signature">
        <h2 id="set-signature" className="text-base font-semibold">
          {current?.has_signature ? "Set a new signature" : "Add your signature"}
        </h2>

        <div role="group" aria-label="How to add it" className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { value: "draw", label: "Draw", icon: PenLine },
              { value: "upload", label: "Upload", icon: Upload },
            ] as const
          ).map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                mode === m.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <m.icon className="size-4" aria-hidden="true" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Both panels stay mounted so a drawing isn't lost when switching. */}
        <div hidden={mode !== "draw"} className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Sign in the box with your finger or the mouse, as you sign on paper.
          </p>
          <SignaturePad ref={padRef} onChange={setStrokes} label="Signature box: sign here with your finger or the mouse" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => padRef.current?.undo()}
              disabled={strokes === 0 || save.isPending}
            >
              <Undo2 aria-hidden="true" />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => padRef.current?.clear()}
              disabled={strokes === 0 || save.isPending}
            >
              <Eraser aria-hidden="true" />
              Clear
            </Button>
          </div>
        </div>

        <div hidden={mode !== "upload"} className="mt-4">
          <ImagePicker
            what="signature"
            value={picked}
            onChange={setPicked}
            previewClassName="h-32"
            disabled={save.isPending}
            hint="Sign on white paper with a dark pen, then take a photo or scan it. PNG or JPEG, up to 1 MB. Empty space around it is cut off."
          />
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" className="min-h-11" onClick={onSave} disabled={!canSave || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save signature
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove your signature?"
        description="Report cards published from now on will show a blank line where you sign. Report cards already published keep the signature they were published with."
        confirmLabel="Remove signature"
        destructive
        onConfirm={async () => {
          try {
            await remove.mutateAsync()
            notify.success("Signature removed.")
          } catch (error) {
            notify.error(`${errorText(error, "The signature wasn't removed.")} Try again.`)
            throw error
          }
        }}
      />
    </PageShell>
  )
}
