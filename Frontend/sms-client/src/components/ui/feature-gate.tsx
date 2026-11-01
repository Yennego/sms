"use client"

// Shows its children only while the school has a feature switched on (tenant settings ->
// features, set by the platform operator). The server refuses the feature's routes too.

import * as React from "react"
import { PowerOff } from "lucide-react"

import { EmptyState } from "@/components/ui/empty-state"
import { PageShell } from "@/components/ui/page-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { useTenantFeatures } from "@/hooks/use-tenant-features"

export function FeatureGate({
  feature,
  label,
  page = true,
  children,
}: {
  feature: string
  /** What the feature is called on screen, e.g. "Fees". */
  label: string
  /** Wrap the message in a page heading (false inside a tab). */
  page?: boolean
  children: React.ReactNode
}) {
  const { isFeatureEnabled, isLoading } = useTenantFeatures()

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />
  if (isFeatureEnabled(feature)) return <>{children}</>

  const message = (
    <EmptyState
      icon={PowerOff}
      title={`${label} is turned off`}
      description={`${label} isn't switched on for this school. Ask the platform operator to turn it on.`}
    />
  )
  return page ? <PageShell title={label}>{message}</PageShell> : message
}
