// Checks a picked image before upload (signatures and the school seal): PNG or JPEG, at most 1 MB.
//
// Phone camera photos are usually 2 to 5 MB, so a JPEG over the limit is first shrunk in the
// browser (long side at most 1600 px, re-encoded as JPEG) — plenty for a signature that the
// server scales to 600 x 200 anyway. A PNG over the limit is shrunk the same way but kept as PNG
// (it may have a transparent background). If it is still too big the person gets a plain message.

export const MAX_UPLOAD_BYTES = 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"] as const
const MAX_SIDE = 1600

export type PreparedImage = { ok: true; file: Blob; filename: string; shrunk: boolean } | { ok: false; error: string }

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("unreadable"))
    }
    img.src = url
  })
}

async function shrink(file: File): Promise<Blob | null> {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const png = file.type === "image/png"
  if (!png) {
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), png ? "image/png" : "image/jpeg", 0.85))
}

export async function prepareImage(file: File, what = "image"): Promise<PreparedImage> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: `This file isn't a PNG or JPEG picture. Choose a photo or scan of your ${what}.` }
  }
  if (file.size <= MAX_UPLOAD_BYTES) return { ok: true, file, filename: file.name, shrunk: false }
  try {
    const smaller = await shrink(file)
    if (smaller && smaller.size <= MAX_UPLOAD_BYTES) {
      const base = file.name.replace(/\.[^.]+$/, "") || what
      return {
        ok: true,
        file: smaller,
        filename: `${base}.${smaller.type === "image/png" ? "png" : "jpg"}`,
        shrunk: true,
      }
    }
  } catch {
    return { ok: false, error: `This picture couldn't be opened. Choose another PNG or JPEG of your ${what}.` }
  }
  return {
    ok: false,
    error: `This picture is ${megabytes(file.size)}, more than the 1 MB allowed. Crop it to just the ${what} and try again.`,
  }
}
