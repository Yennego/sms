// Fee statuses in words plus an icon (never colour alone): Paid / Due / Not due yet / Overdue,
// and VOID receipts.
import * as React from 'react';
import { AlertTriangle, Ban, CalendarClock, CheckCircle2, Hourglass } from 'lucide-react';

import { StatusBadge } from '@/components/ui/status-badge';
import type { InstallmentStatus } from '@/services/api/family-service';

export function InstallmentBadge({ status, size = 'md' }: { status: InstallmentStatus; size?: 'sm' | 'md' }) {
  switch (status) {
    case 'paid':
      return <StatusBadge status="success" icon={CheckCircle2} label="Paid" size={size} />;
    case 'overdue':
      return <StatusBadge status="danger" icon={AlertTriangle} label="Overdue" size={size} />;
    case 'upcoming':
      return <StatusBadge status="neutral" icon={CalendarClock} label="Not due yet" size={size} />;
    default:
      return <StatusBadge status="pending" icon={Hourglass} label="Due" size={size} />;
  }
}

export function OverdueBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return <StatusBadge status="danger" icon={AlertTriangle} label="Overdue" size={size} />;
}

export function VoidBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return <StatusBadge status="neutral" icon={Ban} label="VOID" size={size} />;
}
