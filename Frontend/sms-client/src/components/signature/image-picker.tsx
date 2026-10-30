"use client"

// Pick a PNG or JPEG (a photo or a scan) and preview it before saving. Used for signatures and
// the school seal. On phones the file input offers the camera as well as the gallery.

import * as React from "react"
import { ImageUp, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { ACCEPTED_IMAGE_TYPES, prepareImage } from "./image-file"

export interface PickedImage {
  file: Blob
  filename: string
  shrunk: boolean
}

export interface ImagePickerProps {
  /** What the picture is of, used in messages ("signature", "school seal"). */
  what: string
  value: PickedImage | null
  onChange: (value: PickedImage | null) => void
  /** Shown under the button. */
  hint?: React.ReactNode
  /** Classes for the preview box (e.g. its height). */
  previewClassName?: string
  disabled?: boolean
}

function ImagePicker({ what, value, onChange, hint, previewClassName, disabled }: ImagePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const inputId = React.useId()
  const errorId = `${inputId}-error`
  const [error, setError] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!value) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(value.file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // picking the same file again still fires change
    if (!file) return
    setChecking(true)
    setError(null)
    try {
      const prepared = await prepareImage(file, what)
      if (prepared.ok) {
        onChange({ file: prepared.file, filename: prepared.filename, shrunk: prepared.shrunk })
      } else {
        setError(prepared.error)
        onChange(null)
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-describedby={error ? errorId : undefined}
        onChange={onFile}
        disabled={disabled}
      />
      {previewUrl ? (
        <div
          className={cn(
            "flex h-40 items-center justify-center rounded-xl border bg-white p-3",
            previewClassName
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob: URL) */}
          <img src={previewUrl} alt={`Preview of the ${what}`} className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled || checking}
          onClick={() => inputRef.current?.click()}
        >
          {checking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImageUp aria-hidden="true" />}
          {value ? "Choose another picture" : "Choose a photo or scan"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" className="min-h-11" disabled={disabled} onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : null}
      </div>
      {value?.shrunk ? (
        <p className="text-sm text-muted-foreground">The picture was made smaller to fit the 1 MB limit.</p>
      ) : null}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { ImagePicker }
