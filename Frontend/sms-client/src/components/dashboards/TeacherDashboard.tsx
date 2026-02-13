'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Users, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useClassService } from '@/services/api/class-service';
import { useTeacherSubjectAssignmentService } from '@/services/api/teacher-subject-assignment-service';
import { Class } from '@/types/class';

interface DashboardStats {
  totalClasses: number;
  totalStudents: number;
  assignmentsDue: number;
  todaySchedule: number;
}

interface TodayClass {
  id: string;
  subject: string;
  grade: string;
  time: string;
  room: string;
}

interface AssignmentStatus {
  id: string;
  title: string;
  class: string;
  dueDate: string;
  submitted: number;
  total: number;
  status: 'pending' | 'completed' | 'overdue';
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { getClassesByTeacher, getClassStudents } = useClassService();
  const { getTeacherAssignments } = useTeacherSubjectAssignmentService();
  
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalClasses: 0,
    totalStudents: 0,
    assignmentsDue: 0,
    todaySchedule: 0
  });
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [assignmentStatus, setAssignmentStatus] = useState<AssignmentStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      setError(null);

      const classes = await getClassesByTeacher(user.id);
      const currentYear = new Date().getFullYear().toString();
      await getTeacherAssignments(user.id, currentYear);

      let totalStudents = 0;
      const classStudentPromises = classes.map(async (cls) => {
        try {
          const students = await getClassStudents(cls.id);
          return students.length;
        } catch (error) {
          console.error(`Error fetching students for class ${cls.id}:`, error);
          return 0;
        }
      });

      const studentCounts = await Promise.all(classStudentPromises);
      totalStudents = studentCounts.reduce((sum, count) => sum + count, 0);

      const todaySchedule = generateTodaySchedule(classes);
      const mockAssignments = generateMockAssignments(classes);

      setStats({
        totalClasses: classes.length,
        totalStudents,
        assignmentsDue: mockAssignments.filter(a => a.status === 'pending').length,
        todaySchedule: todaySchedule.length
      });

      setTodayClasses(todaySchedule);
      setAssignmentStatus(mockAssignments);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, getClassesByTeacher, getClassStudents, getTeacherAssignments]);

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id, loadDashboardData]);

  

  const generateTodaySchedule = (classes: Class[]): TodayClass[] => {
    // Mock schedule generation - in real implementation, this would come from a schedule API
    const times = ['09:00 AM', '11:00 AM', '02:00 PM', '03:30 PM'];
    const rooms = ['Room 101', 'Room 203', 'Room 105', 'Room 207'];
    
    return classes.slice(0, 4).map((cls, index) => ({
      id: cls.id,
      subject: cls.subject?.name || 'Unknown Subject',
      grade: `${cls.grade?.name || 'Unknown Grade'} ${cls.section?.name || ''}`,
      time: times[index] || '09:00 AM',
      room: rooms[index] || 'TBA'
    }));
  };

  const generateMockAssignments = (classes: Class[]): AssignmentStatus[] => {
    // Mock assignment generation - in real implementation, this would come from an assignments API
    const assignmentTypes = ['Quiz', 'Lab Report', 'Assignment', 'Project', 'Test'];
    const statuses: ('pending' | 'completed' | 'overdue')[] = ['pending', 'completed', 'overdue'];
    
    return classes.slice(0, 3).map((cls, index) => {
      const total = Math.floor(Math.random() * 20) + 20; // 20-40 students
      const submitted = Math.floor(Math.random() * total);
      const status = statuses[index % statuses.length];
      
      return {
        id: `assignment-${cls.id}-${index}`,
        title: `${cls.subject?.name || 'Subject'} ${assignmentTypes[index % assignmentTypes.length]}`,
        class: `${cls.grade?.name || 'Grade'} ${cls.section?.name || ''} ${cls.subject?.name || ''}`,
        dueDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        submitted,
        total,
        status
      };
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'overdue':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadDashboardData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
        <p className="text-gray-500">Welcome back, {user?.first_name} {user?.last_name}</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClasses}</div>
            <p className="text-xs text-muted-foreground">Total classes assigned</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">Across all classes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assignments Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignmentsDue}</div>
            <p className="text-xs text-muted-foreground">Pending submissions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Schedule</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todaySchedule}</div>
            <p className="text-xs text-muted-foreground">Classes today</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Classes */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {todayClasses.length > 0 ? (
              <div className="space-y-4">
                {todayClasses.map((cls) => (
                  <div key={cls.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{cls.subject}</p>
                      <p className="text-sm text-gray-500">{cls.grade}</p>
                      <p className="text-sm text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {cls.time} • {cls.room}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No classes scheduled for today</p>
            )}
          </CardContent>
        </Card>
        
        {/* Assignment Status */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {assignmentStatus.length > 0 ? (
              <div className="space-y-4">
                {assignmentStatus.map((assignment) => (
                  <div key={assignment.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(assignment.status)}
                        <p className="font-medium">{assignment.title}</p>
                      </div>
                      <p className="text-sm text-gray-500">{assignment.class}</p>
                      <p className="text-sm text-gray-500">Due: {assignment.dueDate}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(assignment.status)}>
                        {assignment.status}
                      </Badge>
                      <p className="text-sm text-gray-500 mt-1">
                        {assignment.submitted}/{assignment.total} submitted
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No assignments found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
