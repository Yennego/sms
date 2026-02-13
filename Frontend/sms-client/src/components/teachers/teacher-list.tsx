import React, { useState, useMemo } from 'react';
import { Search, Filter, Eye, Edit, Trash2, UserCheck, UserX, ChevronDown, KeyRound } from 'lucide-react';
import { Teacher, TeacherFilters } from '@/types/teacher';
import { useTeachers, useDepartments } from '@/hooks/queries/teachers';
import { useClasses } from '@/hooks/queries/classes';
import { useQueryClient } from '@tanstack/react-query';

interface TeacherListProps {
  onEdit?: (teacher: Teacher) => void;
  onView?: (teacher: Teacher) => void;
  onDelete?: (teacher: Teacher) => void;
  onStatusToggle?: (teacher: Teacher) => Promise<void>;
  onAdd?: () => void;
  onResetPassword?: (teacher: Teacher) => void;
}

export function TeacherList({ onEdit, onView, onDelete, onStatusToggle, onAdd, onResetPassword }: TeacherListProps) {
  const [filters, setFilters] = useState<TeacherFilters>({
    search: '',
    department: 'all',
    status: 'all',
    is_class_teacher: undefined,
  });

  const queryClient = useQueryClient();

  const queryParams = useMemo(() => {
    const cleanFilters: TeacherFilters = {
      search: filters.search?.trim() || undefined,
      department: filters.department === 'all' ? undefined : filters.department,
      status: filters.status === 'all' ? undefined : filters.status,
      is_class_teacher: filters.is_class_teacher,
    };
    return cleanFilters;
  }, [filters]);

  const { data: teachers = [], isLoading: teachersLoading, isError, error: teachersError } = useTeachers(queryParams);
  const { data: departments = [] } = useDepartments();
  const { data: allClasses = [] } = useClasses();

  const teacherAssignments = useMemo(() => {
    const assignmentMap = new Map<string, any[]>();
    allClasses.forEach(classItem => {
      if (classItem.teacher_id) {
        const existing = assignmentMap.get(classItem.teacher_id) || [];
        assignmentMap.set(classItem.teacher_id, [...existing, classItem]);
      }
    });
    return assignmentMap;
  }, [allClasses]);

  const handleFilterChange = (key: keyof TeacherFilters, value: string | boolean | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'retired': return 'bg-blue-100 text-blue-800';
      case 'resigned': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['teachers'] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
  };

  if (teachersLoading && teachers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{teachersError instanceof Error ? teachersError.message : 'Failed to fetch teachers'}</p>
        <button
          onClick={handleRetry}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Teachers</h2>
          <p className="text-gray-600 mt-1">
            {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} found
          </p>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add New Teacher
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by name, email, or employee ID..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filters.status || 'all'}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="retired">Retired</option>
              <option value="resigned">Resigned</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={filters.department || 'all'}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
          </div>

          {/* Class Teacher Filter */}
          <div className="relative">
            <select
              value={filters.is_class_teacher === undefined ? 'all' : filters.is_class_teacher.toString()}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange('is_class_teacher', value === 'all' ? undefined : value === 'true');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Teachers</option>
              <option value="true">Class Teachers</option>
              <option value="false">Subject Teachers</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Teachers Grid */}
      <div className="relative min-h-[400px]">
        {teachersLoading && teachers.length > 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {teacher.first_name} {teacher.last_name}
                    </h3>
                    <p className="text-gray-600 text-sm">{teacher.email}</p>
                    <p className="text-gray-500 text-sm">ID: {teacher.employee_id}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(teacher.status)}`}>
                    {teacher.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Department:</span>
                    <span className="text-gray-900">{teacher.department || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Qualification:</span>
                    <span className="text-gray-900">{teacher.qualification || 'N/A'}</span>
                  </div>
                  {teacher.is_class_teacher && (
                    <div className="flex items-center text-sm">
                      <UserCheck className="h-4 w-4 text-blue-500 mr-1" />
                      <span className="text-blue-600 font-medium">Class Teacher</span>
                    </div>
                  )}

                  {/* Assignment Information */}
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <div className="text-sm">
                      <span className="text-gray-500 font-medium">Assignments:</span>
                      <div className="mt-1">
                        {(() => {
                          const assignments = teacherAssignments.get(teacher.id) || [];
                          if (assignments.length === 0) {
                            return (
                              <span className="text-gray-400 text-xs">No assignments</span>
                            );
                          }

                          return (
                            <div className="space-y-1">
                              {assignments.slice(0, 2).map((classItem, index) => (
                                <div key={index} className="text-xs text-gray-600">
                                  {classItem.name || `${classItem.academic_year} Class`}
                                </div>
                              ))}
                              {assignments.length > 2 && (
                                <div className="text-xs text-blue-600">
                                  +{assignments.length - 2} more
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex space-x-2">
                    {onView && (
                      <button
                        onClick={() => onView(teacher)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(teacher)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit Teacher"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    {onResetPassword && (
                      <button
                        onClick={() => onResetPassword(teacher)}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Reset Password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(teacher)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Teacher"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {onStatusToggle && (
                    <button
                      onClick={() => onStatusToggle(teacher)}
                      className={`p-2 rounded-lg transition-colors ${teacher.status === 'active'
                        ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                      title={teacher.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                      {teacher.status === 'active' ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!teachersLoading && teachers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Filter className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No teachers found</h3>
            <p className="text-gray-500">Try adjusting your search criteria or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherList;
