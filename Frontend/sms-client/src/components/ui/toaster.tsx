"use client"

// The one toast system (sonner). Mount <Toaster /> once in the root layout and use `notify`
// (or sonner's `toast`) everywhere instead of alert() or use-toast.

import * as React from "react"
import { Toaster as Sonner, toast, type ExternalToast, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      richColors
      closeButton
      duration={5000}
      visibleToasts={3}
      toastOptions={{ classNames: { toast: "text-sm" } }}
      {...props}
    />
  )
}

type Message = React.ReactNode
type Options = ExternalToast

const notify = {
  success: (message: Message, options?: Options) => toast.success(message, options),
  /** Errors stay longer: say what went wrong and what to do. */
  error: (message: Message, options?: Options) => toast.error(message, { duration: 8000, ...options }),
  info: (message: Message, options?: Options) => toast.info(message, options),
  warning: (message: Message, options?: Options) => toast.warning(message, options),
  promise: toast.promise,
  dismiss: toast.dismiss,
}

export { Toaster, notify }
