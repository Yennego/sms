'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardList,
  School,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  TrendingUp,
  FileText,
  CheckCircle2,
  ListChecks,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { SchoolStructureManager } from '@/components/academics/SchoolStructureManager';
import { useAcademicStats } from '@/hooks/queries/academics';

interface AcademicStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  totalGrades: number;
  totalSections: number;
  activeAcademicYear: string;
  assignmentCompletion: number;
  enrollmentCompletion: number;
}

interface ConfigurationStatus {
  academicYears: boolean;
  grades: boolean;
  sections: boolean;
  subjects: boolean;
  classes: boolean;
  teachers: boolean;
  students: boolean;
}

export default function AcademicsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantDomain = params?.tenantDomain as string;
  const defaultTab = searchParams.get('tab') || 'overview';
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useAcademicStats();

  // Robust Admin check
  const isAdmin = user?.role?.toLowerCase() === 'admin' ||
    user?.role?.toLowerCase() === 'super-admin' ||
    user?.roles?.some((r: any) =>
      ['admin', 'superadmin', 'super-admin'].includes(r.name.toLowerCase())
    );

  // Derive stats with camelCase for UI compatibility
  const stats: AcademicStats | null = data ? {
    totalStudents: data.total_students || 0,
    totalTeachers: data.total_teachers || 0,
    totalClasses: data.total_classes || 0,
    totalSubjects: data.total_subjects || 0,
    totalGrades: data.total_grades || 0,
    totalSections: data.total_sections || 0,
    activeAcademicYear: data.active_academic_year || 'Not Set',
    assignmentCompletion: data.assignment_completion || 0,
    enrollmentCompletion: data.enrollment_completion || 0
  } : null;

  const configStatus: ConfigurationStatus | null = data ? {
    academicYears: data.active_academic_year !== 'Not Set',
    grades: data.total_grades > 0,
    sections: data.total_sections > 0,
    subjects: data.total_subjects > 0,
    classes: data.total_classes > 0,
    teachers: data.total_teachers > 0,
    students: data.total_students > 0
  } : null;

  const handleTabChange = useCallback((value: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('tab', value);
    router.replace(`/${tenantDomain}/academics?${newParams.toString()}`, { scroll: false });
  }, [searchParams, router, tenantDomain]);

  const getConfigurationScore = () => {
    if (!configStatus) return 0;
    const total = Object.keys(configStatus).length;
    const completed = Object.values(configStatus).filter(Boolean).length;
    return Math.round((completed / total) * 100);
  };

  const getConfigurationStatus = (isConfigured: boolean) => {
    return isConfigured ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Configured
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Needs Setup
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading academic data...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Failed to load academic data. Please try again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>
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
          <h1 className="text-3xl font-bold text-gray-900">Academic Management</h1>
          <p className="text-gray-600 mt-1">
            Central hub for managing all academic components and configurations
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Configuration Status Alert */}
      {configStatus && getConfigurationScore() < 100 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Academic configuration is {getConfigurationScore()}% complete.
            Some features may not work properly until all components are configured.
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        defaultValue={defaultTab}
        className="space-y-6"
        onValueChange={handleTabChange}
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="management">Management</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalStudents}</div>
                <p className="text-xs text-muted-foreground">
                  Across all grades and sections
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalTeachers}</div>
                <p className="text-xs text-muted-foreground">
                  Active teaching staff
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                <School className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalClasses}</div>
                <p className="text-xs text-muted-foreground">
                  Grade-Section combinations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalSubjects}</div>
                <p className="text-xs text-muted-foreground">
                  Available subjects
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Grades</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalGrades}</div>
                <p className="text-xs text-muted-foreground">
                  Academic grades
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sections</CardTitle>
                <School className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalSections}</div>
                <p className="text-xs text-muted-foreground">
                  Class sections
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Academic Year</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeAcademicYear}</div>
                <p className="text-xs text-muted-foreground">
                  Current academic year
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Teacher Assignment Progress</CardTitle>
                <CardDescription>
                  Percentage of subjects assigned to teachers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${stats?.assignmentCompletion}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{stats?.assignmentCompletion}%</span>
                </div>
                <Link href={`/${tenantDomain}/academics/teacher-assignments`}>
                  <Button variant="outline" size="sm" className="mt-3">
                    Manage Assignments
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Student Enrollment Progress</CardTitle>
                <CardDescription>
                  Percentage of students enrolled in classes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${stats?.enrollmentCompletion}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{stats?.enrollmentCompletion}%</span>
                </div>
                <Link href={`/${tenantDomain}/academics/enrollments`}>
                  <Button variant="outline" size="sm" className="mt-3">
                    Manage Enrollments
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Admin Quick Actions */}
          {isAdmin && (
            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Administrative Quick Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href={`/${tenantDomain}/academics/structure`}>
                  <Card
                    className="border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 transition-colors cursor-pointer group"
                  >
                    <div className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                          <School className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-indigo-900">Academic Structure</h4>
                          <p className="text-xs text-indigo-700/70">Manage semesters, periods, and global publication.</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration Status</CardTitle>
              <CardDescription>
                Ensure all components are properly configured for the academic system to work correctly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Academic Years</span>
                  </div>
                  {configStatus && getConfigurationStatus(configStatus.academicYears)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Target className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Grades</span>
                  </div>
                  {configStatus && getConfigurationStatus(configStatus.grades)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <School className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Sections</span>
                  </div>
                  {configStatus && getConfigurationStatus(configStatus.sections)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <BookOpen className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Subjects</span>
                  </div>
                  {configStatus && getConfigurationStatus(configStatus.subjects)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <School className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Classes</span>
                  </div>
                  {configStatus && getConfigurationStatus(configStatus.classes)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Users className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Teachers</span>
                  </div>
                  {configStatus && getConfigurationStatus(configStatus.teachers)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <GraduationCap className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Students</span>
                  </div>
                  {configStatus && getConfigurationStatus(configStatus.students)}
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Configuration Order</h4>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Set up Academic Years</li>
                  <li>2. Configure Grades and Sections</li>
                  <li>3. Add Subjects</li>
                  <li>4. Create Classes (Grade + Section + Subject combinations)</li>
                  <li>5. Add Teachers and Students</li>
                  <li>6. Assign Teachers to Subjects</li>
                  <li>7. Enroll Students in Classes</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structure Tab */}
        <TabsContent value="structure" className="space-y-6">
          <SchoolStructureManager />
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Teacher Assignments</CardTitle>
                <CardDescription>
                  Assign teachers to subjects and classes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Completion Rate</span>
                    <span className="font-medium">{stats?.assignmentCompletion}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${stats?.assignmentCompletion}%` }}
                    ></div>
                  </div>
                  <Link href={`/${tenantDomain}/academics/teacher-assignments`}>
                    <Button className="w-full mt-4">
                      Manage Teacher Assignments
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Student Assignments</CardTitle>
                <CardDescription>
                  Assign students to classes and subjects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Enrollment Rate</span>
                    <span className="font-medium">{stats?.enrollmentCompletion}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${stats?.enrollmentCompletion}%` }}
                    ></div>
                  </div>
                  <Link href={`/${tenantDomain}/academics/student-assignments`}>
                    <Button className="w-full mt-4">
                      Manage Student Assignments
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Management Tab */}
        <TabsContent value="management" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Master Data Management */}
            <Card>
              <CardHeader>
                <CardTitle>Master Data</CardTitle>
                <CardDescription>
                  Manage core academic data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/${tenantDomain}/academics/academic-years`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    Academic Years
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/semesters`}>
                  <Button variant="outline" className="w-full justify-start border-teal-100 text-teal-700 hover:bg-teal-50">
                    <Calendar className="w-4 h-4 mr-2" />
                    Semesters Management
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/grades`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Target className="w-4 h-4 mr-2" />
                    Grades
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/sections`}>
                  <Button variant="outline" className="w-full justify-start">
                    <School className="w-4 h-4 mr-2" />
                    Sections
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/subjects`}>
                  <Button variant="outline" className="w-full justify-start">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Subjects
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/assessments`}>
                  <Button variant="outline" className="w-full justify-start border-blue-200 text-blue-700 hover:bg-blue-50">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Assessments Hub
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Class Management */}
            <Card>
              <CardHeader>
                <CardTitle>Class Management</CardTitle>
                <CardDescription>
                  Manage classes and enrollments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/${tenantDomain}/academics/classes`}>
                  <Button variant="outline" className="w-full justify-start">
                    <School className="w-4 h-4 mr-2" />
                    Classes
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/enrollments`}>
                  <Button variant="outline" className="w-full justify-start">
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Enrollments
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/timetables`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    Timetables
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Assessment Management */}
            <Card>
              <CardHeader>
                <CardTitle>Assessment</CardTitle>
                <CardDescription>
                  Manage exams and evaluations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/${tenantDomain}/academics/report-cards`}>
                  <Button variant="outline" className="w-full justify-start border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    <FileText className="w-4 h-4 mr-2" />
                    Report Cards
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/gradebook`}>
                  <Button variant="outline" className="w-full justify-start">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Gradebook
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/grading-hub`}>
                  <Button variant="outline" className="w-full justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    <ListChecks className="w-4 h-4 mr-2" />
                    Grading Hub
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/exams`}>
                  <Button variant="outline" className="w-full justify-start">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Exams
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/grades`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Target className="w-4 h-4 mr-2" />
                    Grades
                  </Button>
                </Link>
                <Link href={`/${tenantDomain}/academics/attendance`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    Attendance
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}