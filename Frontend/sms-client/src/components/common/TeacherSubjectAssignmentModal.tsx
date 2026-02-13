import React, { useState, useEffect } from 'react';
import { X, User, BookOpen, GraduationCap, Users, Plus, Scale } from 'lucide-react';
import { Teacher } from '@/types/teacher';
import { AcademicGrade } from '@/types/academic-grade';
import { Section } from '@/types/section';
import { Subject } from '@/types/subject';
import { ClassSubjectAssignment, TeacherSubjectAssignmentCreate } from '@/types/teacher-subject-assignment';
import { useCreateAssignment, useReassignTeacher } from '@/hooks/queries/teacher-assignments';
import { toast } from 'sonner';
import { GradingSchema } from '@/services/api/grading-service';

interface TeacherSubjectAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  availableAssignments: ClassSubjectAssignment[];
  grades: AcademicGrade[];
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  academicYearId: string;
  gradingSchemas?: GradingSchema[];
  onAssignmentComplete: () => void;
}

export const TeacherSubjectAssignmentModal: React.FC<TeacherSubjectAssignmentModalProps> = ({
  isOpen,
  onClose,
  teacher,
  availableAssignments,
  grades,
  sections,
  subjects,
  teachers,
  academicYearId,
  gradingSchemas = [],
  onAssignmentComplete,
}) => {
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [filteredAssignments, setFilteredAssignments] = useState<ClassSubjectAssignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [defaultRoom, setDefaultRoom] = useState('');
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('');

  const createMutation = useCreateAssignment();
  const reassignMutation = useReassignTeacher();

  useEffect(() => {
    if (isOpen && teacher) {
      setDataLoaded(false);
      setSelectedAssignments([]);

      // 1. Show all subjects passed in (unassigned + assigned slots)
      let filtered = [...availableAssignments];

      // 2. Apply UI filters
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(a =>
          a.class_name.toLowerCase().includes(term) ||
          a.subject_name?.toLowerCase().includes(term) ||
          a.grade_name?.toLowerCase().includes(term) ||
          a.section_name?.toLowerCase().includes(term)
        );
      }

      if (filterGrade !== 'all') {
        filtered = filtered.filter(a => a.grade_id === filterGrade);
      }

      if (filterSubject !== 'all') {
        filtered = filtered.filter(a => a.subject_id === filterSubject);
      }

      setFilteredAssignments(filtered);
      setDataLoaded(true);
    }
  }, [isOpen, teacher, availableAssignments, searchTerm, filterGrade, filterSubject]);

  // Add escape key handler
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        console.log('[TeacherSubjectAssignmentModal] Escape key pressed, calling onClose');
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, onClose]);

  const handleAssignmentToggle = (assignmentKey: string, disabled: boolean) => {
    if (disabled) {
      console.log('[TeacherSubjectAssignmentModal] Toggle ignored: assignment is disabled', assignmentKey);
      return;
    }
    setSelectedAssignments(prev =>
      prev.includes(assignmentKey)
        ? prev.filter(key => key !== assignmentKey)
        : [...prev, assignmentKey]
    );
  };

  const selectAll = () => {
    const validKeys = filteredAssignments
      .filter(a => !a.is_assigned || a.teacher_id === teacher?.id)
      .map((a, i) => getAssignmentKey(a, i));
    setSelectedAssignments(validKeys);
  };

  const selectUnassigned = () => {
    const unassignedKeys = filteredAssignments
      .filter(a => !a.is_assigned)
      .map((a, i) => getAssignmentKey(a, i));
    setSelectedAssignments(unassignedKeys);
  };

  const clearSelection = () => {
    setSelectedAssignments([]);
    setDefaultRoom('');
  };

  const getAssignmentKey = (assignment: ClassSubjectAssignment, index?: number) => {
    // Include academic year ID and index to ensure uniqueness
    const baseKey = `${assignment.grade_id}-${assignment.section_id}-${assignment.subject_id}-${academicYearId}`;
    return index !== undefined ? `${baseKey}-${index}` : baseKey;
  };

  const handleAssign = async () => {
    if (!teacher || selectedAssignments.length === 0) return;

    setLoading(true);
    console.log('Starting assignment process for teacher:', teacher.first_name, teacher.last_name);
    console.log('Selected assignments:', selectedAssignments);

    try {
      const assignmentPromises = selectedAssignments.map(async (assignmentKey) => {
        const assignment = filteredAssignments.find((a, index) => getAssignmentKey(a, index) === assignmentKey);
        if (!assignment) return;

        console.log('Processing assignment:', assignment.class_name);

        const assignmentData: TeacherSubjectAssignmentCreate = {
          teacher_id: teacher.id,
          grade_id: assignment.grade_id,
          section_id: assignment.section_id,
          subject_id: assignment.subject_id,
          academic_year_id: academicYearId,
          room: defaultRoom || undefined,
          grading_schema_id: selectedSchemaId || undefined,
          is_active: true,
          start_date: new Date().toISOString().split('T')[0], // Ensure start_date is provided if required
        };

        if (assignment.is_assigned && assignment.teacher_id === teacher.id) {
          console.log(`Skipping ${assignment.class_name} - already assigned to this teacher.`);
          return;
        }

        if (assignment.is_assigned && assignment.teacher_id !== teacher.id) {
          // This is a reassignment
          const previousTeacherName = assignment.teacher_name || 'Another Teacher';
          console.log(`Reassigning ${assignment.class_name} from ${previousTeacherName} to ${teacher.first_name} ${teacher.last_name}`);

          await reassignMutation.mutateAsync({
            gradeId: assignment.grade_id,
            sectionId: assignment.section_id,
            subjectId: assignment.subject_id,
            academicYearId: academicYearId,
            newTeacherId: teacher.id
          });

          toast.success(
            `${assignment.class_name} reassigned from ${previousTeacherName} to ${teacher.first_name} ${teacher.last_name}`
          );
        } else {
          // This is a new assignment
          console.log(`Assigning ${assignment.class_name} to ${teacher.first_name} ${teacher.last_name}`);

          await createMutation.mutateAsync(assignmentData);

          toast.success(
            `${assignment.class_name} assigned to ${teacher.first_name} ${teacher.last_name}`
          );
        }
      });

      await Promise.all(assignmentPromises);

      console.log('All assignments completed successfully');
      onAssignmentComplete();
      onClose();
    } catch (error: any) {
      console.error('Assignment failed:', error);

      const errorMessage = error.response?.data?.detail || error.message || 'Failed to complete assignments.';

      if (errorMessage.includes('already assigned') || errorMessage.includes('Assignment')) {
        toast.error(errorMessage);
      } else {
        toast.error('Failed to complete assignments. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getButtonText = () => {
    if (loading) return 'Processing...';
    if (!dataLoaded) return 'Loading...';
    if (selectedAssignments.length === 0) return 'Select Subjects to Assign';

    const reassignments = selectedAssignments.filter(key => {
      const assignment = filteredAssignments.find(a => getAssignmentKey(a) === key);
      return assignment?.is_assigned && assignment.teacher_id !== teacher?.id;
    }).length;

    const newAssignments = selectedAssignments.length - reassignments;

    if (reassignments > 0 && newAssignments > 0) {
      return `Assign ${newAssignments} & Reassign ${reassignments} Subjects`;
    } else if (reassignments > 0) {
      return `Reassign ${reassignments} Subject${reassignments > 1 ? 's' : ''}`;
    } else {
      return `Assign ${newAssignments} Subject${newAssignments > 1 ? 's' : ''}`;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Assign Subject Teacher</h2>
              <p className="text-sm text-gray-600">Assign a teacher to teach specific subjects in this class.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Teacher Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <User className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium text-blue-900">Teacher Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2 font-medium">{teacher?.first_name} {teacher?.last_name}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2">{teacher?.email}</span>
              </div>
              <div>
                <span className="text-gray-500">Department:</span>
                <span className="ml-2">{teacher?.department || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-gray-500">Employee ID:</span>
                <span className="ml-2">{teacher?.employee_id || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Subject Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Subjects to Assign
            </label>
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> You can assign multiple subjects to {teacher?.first_name} {teacher?.last_name}.
                Subjects assigned to other teachers are disabled to maintain data integrity. You can reassign them from the main assignments list if needed.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <X
                  className={`absolute right-3 top-2.5 h-4 w-4 text-gray-400 cursor-pointer ${!searchTerm && 'hidden'}`}
                  onClick={() => setSearchTerm('')}
                />
                <input
                  type="text"
                  placeholder="Search classes or subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="all">All Grades</option>
                {grades.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="all">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Select {filteredAssignments.length} Filtered
              </button>
              <button
                type="button"
                onClick={selectUnassigned}
                className="text-xs font-medium px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
              >
                Select Unassigned
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterGrade('all');
                  setFilterSubject('all');
                  clearSelection();
                }}
                className="text-xs font-medium px-3 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100"
              >
                Reset All
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room / Location (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Room 101, Science Lab..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={defaultRoom}
                onChange={(e) => setDefaultRoom(e.target.value)}
              />
              <p className="text-[10px] text-gray-500 mt-1">This room will be applied to all selected subjects.</p>
            </div>

            {/* Grading Schema Selection */}
            {gradingSchemas.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Scale className="h-4 w-4 text-blue-500" />
                  Grading Schema (Optional)
                </label>
                <select
                  value={selectedSchemaId}
                  onChange={(e) => setSelectedSchemaId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">Default (no specific schema)</option>
                  {gradingSchemas.filter(s => s.is_active).map(schema => (
                    <option key={schema.id} value={schema.id}>
                      {schema.name} {schema.categories.length > 0 && `(${schema.categories.map(c => `${c.name} ${c.weight}%`).join(', ')})`}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">Links grading weights to these subject assignments.</p>
              </div>
            )}

            {!dataLoaded ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading available subjects...</span>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No subjects available for assignment</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Group by Grade/Section */}
                {Object.entries(
                  filteredAssignments.reduce((groups, a) => {
                    const groupKey = `${a.grade_name} - ${a.section_name}`;
                    if (!groups[groupKey]) groups[groupKey] = [];
                    groups[groupKey].push(a);
                    return groups;
                  }, {} as Record<string, ClassSubjectAssignment[]>)
                ).map(([groupName, groupAssignments]) => (
                  <div key={groupName} className="space-y-2 border-l-4 border-blue-200 pl-4 py-1">
                    <h5 className="text-sm font-bold text-gray-700 flex items-center">
                      <GraduationCap className="h-4 w-4 mr-2 text-blue-500" />
                      {groupName}
                    </h5>
                    <div className="grid gap-2">
                      {groupAssignments.map((assignment) => {
                        // Find real index in parent array for key generation
                        const realIndex = availableAssignments.findIndex(a =>
                          a.grade_id === assignment.grade_id &&
                          a.section_id === assignment.section_id &&
                          a.subject_id === assignment.subject_id
                        );
                        const assignmentKey = getAssignmentKey(assignment, realIndex);
                        const isSelected = selectedAssignments.includes(assignmentKey);
                        const isCurrentlyAssigned = assignment.is_assigned && (
                          String(assignment.teacher_id).toLowerCase().trim() === String(teacher?.id).toLowerCase().trim()
                        );
                        const isAssignedToOther = assignment.is_assigned && !isCurrentlyAssigned;

                        return (
                          <div
                            key={assignmentKey}
                            className={`p-3 border rounded-lg transition-all ${isAssignedToOther
                              ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                              : isCurrentlyAssigned
                                ? 'border-green-200 bg-green-50/50 opacity-80 cursor-not-allowed'
                                : isSelected
                                  ? 'border-blue-500 bg-blue-50 cursor-pointer shadow-sm'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                              }`}
                            onClick={() => handleAssignmentToggle(assignmentKey, isAssignedToOther || isCurrentlyAssigned)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <BookOpen className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                                  <h4 className={`font-medium text-sm ${isAssignedToOther ? 'text-gray-400' : 'text-gray-900'}`}>
                                    {assignment.subject_name}
                                  </h4>
                                  {isCurrentlyAssigned && (
                                    <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-800 rounded-full">
                                      Current
                                    </span>
                                  )}
                                  {isAssignedToOther && (
                                    <span className="px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded-full border border-red-200">
                                      Assigned: {assignment.teacher_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className={`w-4 h-4 rounded border-2 ${isSelected
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                                  }`}>
                                  {isSelected && (
                                    <div className="w-full h-full rounded bg-white scale-50"></div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={loading || !dataLoaded || selectedAssignments.length === 0}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${loading || !dataLoaded || selectedAssignments.length === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {getButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
};
