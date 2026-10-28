// StatusBadge: fixed status colours from the design brief (4.1), always paired with text
// (and by default an icon) so colour is never the only signal.

import * as React from "react"
import { cva } from "class-variance-authority"
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  HeartPulse,
  Hourglass,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        green: "border-green-200 bg-green-50 text-green-800",
        orange: "border-orange-200 bg-orange-50 text-orange-800",
        red: "border-red-200 bg-red-50 text-red-800",
        blue: "border-blue-200 bg-blue-50 text-blue-800",
        amber: "border-amber-200 bg-amber-50 text-amber-900",
        slate: "border-slate-200 bg-slate-50 text-slate-700",
      },
      size: {
        sm: "text-xs",
        md: "px-3 py-1 text-sm [&_svg]:size-4",
      },
    },
    defaultVariants: { tone: "slate", size: "sm" },
  }
)

type Tone = "green" | "orange" | "red" | "blue" | "amber" | "slate"

const STATUS_CONFIG = {
  // Attendance and workflow statuses (fixed across the app)
  present: { tone: "green", label: "Present", icon: CheckCircle2 },
  late: { tone: "orange", label: "Late", icon: Clock },
  absent: { tone: "red", label: "Absent", icon: XCircle },
  excused: { tone: "blue", label: "Excused", icon: Info },
  sick: { tone: "blue", label: "Sick", icon: HeartPulse },
  pending: { tone: "amber", label: "Pending", icon: Hourglass },
  // Generic variants
  neutral: { tone: "slate", label: "", icon: Circle },
  success: { tone: "green", label: "", icon: CheckCircle2 },
  warning: { tone: "amber", label: "", icon: AlertTriangle },
  danger: { tone: "red", label: "", icon: XCircle },
  info: { tone: "blue", label: "", icon: Info },
} as const satisfies Record<string, { tone: Tone; label: string; icon: LucideIcon }>

export type StatusBadgeStatus = keyof typeof STATUS_CONFIG

export interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  status: StatusBadgeStatus
  /** Text to show. Defaults to the status name for fixed statuses (required for generic variants). */
  label?: React.ReactNode
  /** Show the default icon for the status (default true). Pass `icon` to override it. */
  showIcon?: boolean
  icon?: LucideIcon
  size?: "sm" | "md"
}

function StatusBadge({
  status,
  label,
  showIcon = true,
  icon,
  size,
  className,
  ...props
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.neutral
  const Icon = icon ?? config.icon
  const text = label ?? (config.label || status)
  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(statusBadgeVariants({ tone: config.tone, size }), className)}
      {...props}
    >
      {showIcon ? <Icon aria-hidden="true" /> : null}
      <span>{text}</span>
    </span>
  )
}

export { StatusBadge, statusBadgeVariants }
