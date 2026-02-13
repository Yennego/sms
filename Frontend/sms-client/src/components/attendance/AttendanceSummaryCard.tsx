import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AttendanceSummary } from '@/types/attendance';
import { Users, UserCheck, UserX, Clock, AlertCircle } from 'lucide-react';

interface AttendanceSummaryCardProps {
  summary: AttendanceSummary;
  title?: string;
  showProgress?: boolean;
}

export const AttendanceSummaryCard: React.FC<AttendanceSummaryCardProps> = ({
  summary,
  title = 'Attendance Summary',
  showProgress = true
}) => {
  const stats = [
    {
      label: 'Total',
      value: summary.total_students, 
      icon: Users,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    },
    {
      label: 'Present',
      value: summary.present_count,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Absent',
      value: summary.absent_count,
      icon: UserX,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      label: 'Late',
      value: summary.late_count,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      label: 'Excused',
      value: summary.excused_count,
      icon: AlertCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    }
  ];
  
  return (
    <Card className="flex flex-col w-2xl mx-auto shadow-lg">
      <CardHeader className="pb-6 px-6 lg:px-8">
        <CardTitle className="text-xl lg:text-2xl font-semibold text-gray-800">{title}</CardTitle>
        {showProgress && (
          <div className="flex flex-col space-y-4 mt-4 lg:mt-6">
            <div className="flex justify-between items-center">
              <span className="text-base lg:text-lg font-medium text-gray-700">Attendance Rate</span>
              <span className="text-xl lg:text-2xl font-bold text-gray-900">
                {summary.attendance_percentage?.toFixed(1) || '0.0'}%
              </span>
            </div>
            <Progress value={summary.attendance_percentage || 0} className="h-3 lg:h-4" />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-6 lg:px-8 pb-6 lg:pb-8">
        {/* Responsive grid layout */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
          {stats.map(({ label, value, icon: Icon, color, bgColor }) => (
            <div key={label} className={`text-center p-4 lg:p-6 rounded-xl ${bgColor} border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105`}>
              <div className={`flex justify-center mb-3 lg:mb-4 ${color}`}>
                <Icon className="w-6 h-6 lg:w-8 lg:h-8" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">{value || 0}</div>
              <div className="text-sm lg:text-base font-medium text-gray-600">{label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};