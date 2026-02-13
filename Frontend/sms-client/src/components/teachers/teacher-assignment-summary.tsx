import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface TeacherAssignmentSummaryProps {
  totalTeachers: number;
  classAssignments: number;
  subjectAssignments: number;
  teachersWithBothAssignments: number;
}

export const TeacherAssignmentSummary: React.FC<TeacherAssignmentSummaryProps> = ({
  totalTeachers,
  classAssignments,
  subjectAssignments,
  teachersWithBothAssignments,
}) => {
  const completionRate = totalTeachers > 0 ? Math.round((teachersWithBothAssignments / totalTeachers) * 100) : 0;
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Assignment Summary
        </CardTitle>
        <CardDescription>
          Overview of teacher assignments across classes and subjects
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{totalTeachers}</div>
            <div className="text-sm text-gray-600">Total Teachers</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{classAssignments}</div>
            <div className="text-sm text-gray-600">Class Assignments</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{subjectAssignments}</div>
            <div className="text-sm text-gray-600">Subject Assignments</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{completionRate}%</div>
            <div className="text-sm text-gray-600">Completion Rate</div>
            <Badge 
              variant={completionRate >= 80 ? 'default' : completionRate >= 50 ? 'secondary' : 'destructive'}
              className="mt-1"
            >
              {completionRate >= 80 ? 'Excellent' : completionRate >= 50 ? 'Good' : 'Needs Attention'}
            </Badge>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Teachers with both assignments: {teachersWithBothAssignments}
            </span>
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              Incomplete assignments: {totalTeachers - teachersWithBothAssignments}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};