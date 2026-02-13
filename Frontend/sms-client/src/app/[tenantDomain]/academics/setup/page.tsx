'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  Circle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Target,
  School,
  BookOpen,
  Users,
  GraduationCap,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useParams } from 'next/navigation';

// Import API services
import { useAcademicSetupService } from '@/services/api/academic-setup-service';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  required: boolean;
  route: string;
  count?: number;
  action?: () => void;
}

interface SetupData {
  academicYears: number;
  grades: number;
  sections: number;
  subjects: number;
  classes: number;
  teacherAssignments: number;
  studentEnrollments: number;
  semesters?: number
}

export default function AcademicSetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([]);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user for permission checks
  const { user } = useAuth();
  const params = useParams();
  const tenantDomain = params?.tenantDomain as string;

  // Helper function to check if user has required permissions
  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  // Initialize services
  const setupService = useAcademicSetupService();

  const loadSetupStatus = useCallback(async () => {
    const tenantDomain = params?.tenantDomain as string;
    try {
      setLoading(true);
      setError(null);

      const status = await setupService.getSetupStatus();

      const data: SetupData = {
        academicYears: status.academic_years,
        grades: status.grades,
        sections: status.sections,
        subjects: status.subjects,
        classes: status.classes,
        teacherAssignments: status.teacher_assignments,
        studentEnrollments: status.student_enrollments,
        semesters: status.semesters
      };
      setSetupData(data);
      const steps: SetupStep[] = [
        {
          id: 'academic-years',
          title: 'Academic Years',
          description: 'Set up academic years and mark the current active year',
          icon: <Calendar className="h-5 w-5" />,
          completed: data.academicYears > 0,
          required: true,
          route: `/${tenantDomain}/academics/academic-years`,
          count: data.academicYears
        },
        {
          id: 'grades',
          title: 'Grades',
          description: 'Configure grade levels (Grade 1, Grade 2, etc.)',
          icon: <Target className="h-5 w-5" />,
          completed: data.grades > 0,
          required: true,
          route: `/${tenantDomain}/academics/grades`,
          count: data.grades
        },
        {
          id: 'sections',
          title: 'Sections',
          description: 'Set up sections for each grade (Section A, B, C, etc.)',
          icon: <School className="h-5 w-5" />,
          completed: data.sections > 0,
          required: true,
          route: `/${tenantDomain}/academics/sections`,
          count: data.sections
        },
        {
          id: 'subjects',
          title: 'Subjects',
          description: 'Add subjects that will be taught (Math, English, Science, etc.)',
          icon: <BookOpen className="h-5 w-5" />,
          completed: data.subjects > 0,
          required: true,
          route: `/${tenantDomain}/academics/subjects`,
          count: data.subjects
        },
        {
          id: 'grading-schemas',
          title: 'Grading Schemas',
          description: 'Define evaluation rules and weights (Exam 35%, Quiz 20%, etc.)',
          icon: <Settings className="h-5 w-5" />,
          completed: true, // For now, we can check count later if we add it to SetupData
          required: true,
          route: `/${tenantDomain}/academics/grading-schemas`,
        },
        {
          id: 'semesters',
          title: 'Semesters',
          description: 'Configure semesters for the current academic year',
          icon: <Calendar className="h-5 w-5" />,
          completed: (data.semesters || 0) > 0,
          required: false,
          route: `/${tenantDomain}/academics?tab=structure`,
          count: data.semesters
        },
        {
          id: 'classes',
          title: 'Classes',
          description: 'Create classes by combining grades, sections, and subjects',
          icon: <School className="h-5 w-5" />,
          completed: data.classes > 0,
          required: true,
          route: `/${tenantDomain}/academics/classes`,
          count: data.classes
        },
        {
          id: 'teachers',
          title: 'Teachers',
          description: 'Add teaching staff to the system',
          icon: <Users className="h-5 w-5" />,
          completed: status.teachers > 0,
          required: true,
          route: `/${tenantDomain}/teachers`,
          count: status.teachers
        },
        {
          id: 'students',
          title: 'Students',
          description: 'Add students to the system',
          icon: <GraduationCap className="h-5 w-5" />,
          completed: status.students > 0,
          required: true,
          route: `/${tenantDomain}/students`,
          count: status.students
        },
        {
          id: 'teacher-assignments',
          title: 'Teacher Assignments',
          description: 'Assign teachers to subjects and classes',
          icon: <Users className="h-5 w-5" />,
          completed: data.teacherAssignments > 0,
          required: false,
          route: `/${tenantDomain}/academics/teacher-assignments`,
          count: data.teacherAssignments
        },
        {
          id: 'student-enrollments',
          title: 'Student Enrollments',
          description: 'Enroll students in classes',
          icon: <GraduationCap className="h-5 w-5" />,
          completed: data.studentEnrollments > 0,
          required: false,
          route: `/${tenantDomain}/academics/enrollments`,
          count: data.studentEnrollments
        }
      ];

      setSetupSteps(steps);

      // Find the first incomplete required step
      const firstIncomplete = steps.findIndex(step => step.required && !step.completed);
      setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : steps.length - 1);

    } catch (error) {
      console.error('Error loading setup data:', error);
      setError('Failed to load setup data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [params, setupService]);

  useEffect(() => {
    loadSetupStatus();
  }, [loadSetupStatus]);

  const getCompletionPercentage = () => {
    const requiredSteps = setupSteps.filter(step => step.required);
    const completedRequired = requiredSteps.filter(step => step.completed);
    return requiredSteps.length > 0 ? Math.round((completedRequired.length / requiredSteps.length) * 100) : 0;
  };

  const getOverallCompletion = () => {
    const completed = setupSteps.filter(step => step.completed);
    return setupSteps.length > 0 ? Math.round((completed.length / setupSteps.length) * 100) : 0;
  };

  const canProceedToAssignments = () => {
    const requiredSteps = setupSteps.filter(step => step.required);
    return requiredSteps.every(step => step.completed);
  };

  if (loading || !tenantDomain) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading setup data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
        <Button onClick={loadSetupStatus}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Academic Setup Wizard</h1>
          <p className="text-gray-600 mt-1">
            Complete these steps to set up your academic management system
          </p>
        </div>
        <Button variant="outline" onClick={loadSetupStatus}>
          <Settings className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Required Setup Progress</CardTitle>
            <CardDescription>
              Complete all required steps before using assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{getCompletionPercentage()}%</span>
              </div>
              <Progress value={getCompletionPercentage()} className="w-full" />
              {!canProceedToAssignments() && (
                <p className="text-sm text-orange-600 mt-2">
                  Complete required steps to enable teacher and student assignments
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overall Completion</CardTitle>
            <CardDescription>
              Total setup progress including optional steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{getOverallCompletion()}%</span>
              </div>
              <Progress value={getOverallCompletion()} className="w-full" />
              <p className="text-sm text-gray-600 mt-2">
                {setupSteps.filter(s => s.completed).length} of {setupSteps.length} steps completed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Error Alert */}
      {!canProceedToAssignments() && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Setup Incomplete!</strong>
            <br />
            You&apos;re seeing &quot;No subject assignments available&quot; because the required setup steps are not complete.
            Please complete all required steps below to enable teacher assignments.
          </AlertDescription>
        </Alert>
      )}

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Steps</CardTitle>
          <CardDescription>
            Follow these steps in order to properly configure your academic system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {setupSteps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center space-x-4 p-4 rounded-lg border ${step.completed
                  ? 'bg-green-50 border-green-200'
                  : step.required
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-gray-50 border-gray-200'
                  }`}
              >
                <div className="flex-shrink-0">
                  {step.completed ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-400" />
                  )}
                </div>

                <div className="flex-shrink-0 text-gray-600">
                  {step.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {index + 1}. {step.title}
                    </h3>
                    {step.required && (
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    )}
                    {step.completed && (
                      <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                        Complete
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {step.description}
                  </p>
                  {step.count !== undefined && (
                    <p className="text-xs text-gray-500 mt-1">
                      {step.count} configured{step.required ? ` / ${step.required} required` : ''}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {step.route ? (
                    <Link href={step.route}>
                      <Button
                        variant={step.completed ? "outline" : "default"}
                        size="sm"
                      >
                        {step.completed ? "Review" : "Configure"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={step.action}
                      disabled={!step.action}
                    >
                      Configure
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s Next?</CardTitle>
        </CardHeader>
        <CardContent>
          {canProceedToAssignments() ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">All required setup steps are complete!</span>
              </div>
              <p className="text-gray-600">
                You can now proceed with teacher assignments and student enrollments.
              </p>
              <div className="flex space-x-4">
                {hasPermission('manage_teacher_assignments') && (
                  <Link href={`/${tenantDomain}/academics/teacher-assignments`}>
                    <Button>
                      <Users className="w-4 h-4 mr-2" />
                      Manage Teacher Assignments
                    </Button>
                  </Link>
                )}
                <Link href={`/${tenantDomain}/academics/enrollments`}>
                  <Button variant="outline">
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Manage Student Enrollments
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Complete the required steps first</span>
              </div>
              <p className="text-gray-600">
                Focus on completing the required setup steps, especially creating classes for the current academic year.
                This will resolve the &quot;No subject assignments available&quot; error.
              </p>
              {setupSteps.find(s => s.id === 'classes' && !s.completed) && (
                <Link href={`/${tenantDomain}/academics/classes`}>
                  <Button>
                    <School className="w-4 h-4 mr-2" />
                    Configure Classes (Critical)
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}