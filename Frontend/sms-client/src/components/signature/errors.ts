// Plain error text for toasts and empty states (the API client puts the server's message on
// `message` and the HTTP status on `statusCode`).

export function errorText(error: unknown, fallback: string): string {
  const msg =
    error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return msg && !msg.startsWith("{") && msg.length < 300 ? msg : fallback
}

export function statusOf(error: unknown): number | undefined {
  const s = (error as { statusCode?: unknown } | null)?.statusCode
  return typeof s === "number" ? s : undefined
}
