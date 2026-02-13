import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AttendanceStatus } from '@/types/attendance';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceQuickMarkProps {
  currentStatus?: AttendanceStatus;
  onStatusChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusOptions = [
  { status: AttendanceStatus.PRESENT, icon: CheckCircle, color: 'text-green-600 hover:bg-green-50' },
  { status: AttendanceStatus.ABSENT, icon: XCircle, color: 'text-red-600 hover:bg-red-50' },
  { status: AttendanceStatus.LATE, icon: Clock, color: 'text-yellow-600 hover:bg-yellow-50' },
  { status: AttendanceStatus.EXCUSED, icon: AlertCircle, color: 'text-blue-600 hover:bg-blue-50' }
];

export const AttendanceQuickMark: React.FC<AttendanceQuickMarkProps> = ({
  currentStatus,
  onStatusChange,
  disabled = false,
  size = 'md'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleStatusClick = async (status: AttendanceStatus) => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    try {
      await onStatusChange(status);
    } finally {
      setIsLoading(false);
    }
  };
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };
  
  return (
    <div className="flex gap-1">
      {statusOptions.map(({ status, icon: Icon, color }) => (
        <Button
          key={status}
          variant="ghost"
          size="sm"
          className={cn(
            sizeClasses[size],
            'p-1 rounded-full transition-all duration-200',
            color,
            currentStatus === status && 'bg-gray-100 ring-2 ring-gray-300',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => handleStatusClick(status)}
          disabled={disabled || isLoading}
          title={status.charAt(0).toUpperCase() + status.slice(1)}
        >
          <Icon className="w-full h-full" />
        </Button>
      ))}
    </div>
  );
};