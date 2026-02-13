import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AttendanceStatus } from '@/types/attendance';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusConfig = {
  [AttendanceStatus.PRESENT]: {
    label: 'Present',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle
  },
  [AttendanceStatus.ABSENT]: {
    label: 'Absent',
    variant: 'destructive' as const,
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle
  },
  [AttendanceStatus.LATE]: {
    label: 'Late',
    variant: 'secondary' as const,
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock
  },
  [AttendanceStatus.EXCUSED]: {
    label: 'Excused',
    variant: 'outline' as const,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: AlertCircle
  }
};

export const AttendanceStatusBadge: React.FC<AttendanceStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };
  
  return (
    <Badge 
      variant={config.variant}
      className={`${config.className} ${sizeClasses[size]} inline-flex items-center gap-1`}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label}
    </Badge>
  );
};