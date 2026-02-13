'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Student } from '@/types/student';
import { AcademicGrade as Grade } from '@/types/academic-grade';
import { Section } from '@/types/section';
import { Enrollment } from '@/types/enrollment';
import { useStudentService } from '@/services/api/student-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useSectionService } from '@/services/api/section-service';
import { UserCheck, Search, Filter, Users, BookOpen, GraduationCap, Building2, Loader2, UserPlus } from 'lucide-react';
import StudentAssignmentDialog from '@/components/students/student-assignment-dialog';
import { toast } from 'sonner';

interface StudentAssignmentFilters {
  search?: string;
  grade_id?: string;
  section_id?: string;
  status?: string;
}

export default function StudentAssignmentsPage() {
  const params = useParams();
  const tenantDomain = params.tenantDomain as string;

  // State management
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [enrollments, setEnrollments] = useState<Map<string, Enrollment>>(new Map());
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    grade: 'all',
    section: 'all',
    status: 'all'
  });
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Services
  const studentService = useStudentService();
  const enrollmentService = useEnrollmentService();
  const gradeService = useAcademicGradeService();
  const sectionService = useSectionService();

  const toName = (v: any): string => (typeof v === 'string' ? v : v?.name || 'N/A');

  // Effects
  useEffect(() => {
    const timer = setTimeout(() => {
      loadInitialData();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    filterStudents();
  }, [searchTerm, filters, students, enrollments]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load students first
      const studentsData = await studentService.getStudents();
      setStudents(studentsData);

      // Load other data in parallel
      const [gradesData, sectionsData] = await Promise.all([
        gradeService.getAllGrades().catch(() => []),
        sectionService.getSections().catch(() => [])
      ]);

      setGrades(gradesData);
      setSections(sectionsData as any);

      // Load enrollments for each student
      await loadStudentEnrollments(studentsData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      if (error instanceof Error && error.message.includes('API client is not ready')) {
        // Silently ignore this error and retry later
        setTimeout(() => {
          loadInitialData();
        }, 1000);
      } else {
        toast.error('Failed to load student assignments. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStudentEnrollments = async (studentsData: Student[]) => {
    try {
      const ids = studentsData.map(s => s.id).filter(Boolean);
      const bulkMap = await enrollmentService.getBulkCurrentEnrollments(ids);
      setEnrollments(bulkMap);
    } catch (error) {
      console.error('Error loading student enrollments:', error);
    }
  };

  const filterStudents = () => {
    let filtered = students.filter(student => {
      const matchesSearch = !searchTerm ||
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.admission_number?.toLowerCase().includes(searchTerm.toLowerCase());

      const enrollment = enrollments.get(student.id);

      const matchesGrade =
        filters.grade === 'all' || (enrollment?.grade_id && enrollment.grade_id === filters.grade);

      const matchesSection =
        filters.section === 'all' || (enrollment?.section_id && enrollment.section_id === filters.section);

      const matchesStatus = filters.status === 'all' || student.status === filters.status;

      return matchesSearch && matchesGrade && matchesSection && matchesStatus;
    });

    setFilteredStudents(filtered);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({
      grade: 'all',
      section: 'all',
      status: 'all'
    });
  };

  const handleAssignStudent = (student: Student) => {
    setSelectedStudent(student);
    setAssignmentModalOpen(true);
  };

  const handleAssignmentComplete = () => {
    // Reload data after assignment
    loadInitialData();
  };

  // Calculate statistics
  const totalStudents = students.length;
  const assignedStudents = Array.from(enrollments.values()).length;
  const unassignedStudents = totalStudents - assignedStudents;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading student assignments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Assignments</h1>
        <p className="text-gray-600 mt-2">Manage student assignments to grades and sections</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assigned Students</p>
              <p className="text-2xl font-bold text-gray-900">{assignedStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Unassigned Students</p>
              <p className="text-2xl font-bold text-gray-900">{unassignedStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <GraduationCap className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Grades</p>
              <p className="text-2xl font-bold text-gray-900">{grades.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </h2>
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filters.grade}
            onChange={(e) => setFilters(prev => ({ ...prev, grade: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Grades</option>
            {grades.map(grade => (
              <option key={grade.id} value={grade.id}>{grade.name}</option>
            ))}
          </select>

          <select
            value={filters.section}
            onChange={(e) => setFilters(prev => ({ ...prev, section: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Sections</option>
            {sections.map(section => (
              <option key={section.id} value={section.id}>{section.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>
      </div>

      {/* Student Cards */}
      <div className="space-y-4">
        {filteredStudents.length === 0 && !loading ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {students.length === 0 ? 'No students available' : 'No students found'}
            </h3>
            <p className="text-gray-500">
              {students.length === 0
                ? 'Students will appear here once they are added to the system.'
                : 'Try adjusting your search criteria or filters.'
              }
            </p>
          </div>
        ) : (
          filteredStudents.map((student) => {
            const enrollment = enrollments.get(student.id);

            return (
              <div key={student.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {student.firstName} {student.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">{student.email}</p>
                      <p className="text-sm text-gray-500">
                        {student.admission_number} • {student.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${student.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : student.status === 'graduated'
                        ? 'bg-blue-100 text-blue-800'
                        : student.status === 'withdrawn'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                      {student.status}
                    </span>
                    {!enrollment && student.status === 'active' && (
                      <button
                        onClick={() => handleAssignStudent(student)}
                        className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        <UserPlus className="h-3 w-3 inline mr-1" />
                        Assign
                      </button>
                    )}
                  </div>
                </div>

                {/* Current Assignment */}
                {enrollment && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Current Assignment</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Academic Year:</span>
                          <div className="font-medium">{toName(enrollment.academic_year) || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Grade:</span>
                          <div className="font-medium">{toName(enrollment.grade) || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Section:</span>
                          <div className="font-medium">{toName(enrollment.section) || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Enrollment Date:</span>
                          <div className="font-medium">
                            {enrollment.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* No Assignment */}
                {!enrollment && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-sm text-orange-800">
                        <span className="font-medium">Not assigned:</span> This student is not currently assigned to any grade or section.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Student Assignment Modal */}
      <StudentAssignmentDialog
        student={selectedStudent}
        isOpen={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        onSuccess={handleAssignmentComplete}
      />
    </div>
  );
}