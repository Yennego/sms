import React, { useState, useEffect } from 'react';
import { X, User, BookOpen, GraduationCap, Users, Calendar, MapPin } from 'lucide-react';
import { Teacher } from '@/types/teacher';
import { Class } from '@/types/class';
import { AcademicGrade } from '@/types/academic-grade';
import { Section } from '@/types/section';
import { Subject } from '@/types/subject';
import { useClassService } from '@/services/api/class-service';
import { toast } from 'sonner';

interface TeacherAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  availableClasses: Class[];
  grades: AcademicGrade[];
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  onAssignmentComplete: () => void;
}

export function TeacherAssignmentModal({
  isOpen,
  onClose,
  teacher,
  availableClasses,
  grades,
  sections,
  subjects,
  teachers,
  onAssignmentComplete
}: TeacherAssignmentModalProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const classService = useClassService();

  useEffect(() => {
    if (isOpen) {
      console.log('[TeacherAssignmentModal] Modal opened with availableClasses:', availableClasses?.length || 0);
      console.log('[TeacherAssignmentModal] Available classes data:', availableClasses);
      
      // Check if we have meaningful data (not just empty arrays)
      const hasData = availableClasses && availableClasses.length > 0;
      setDataLoaded(hasData);
      
      if (hasData) {
        // Show all available classes (allows reassignment)
        setFilteredClasses(availableClasses);
        console.log('[TeacherAssignmentModal] Filtered classes set:', availableClasses.length);
      } else {
        setFilteredClasses([]);
        console.log('[TeacherAssignmentModal] No classes available');
      }
    }
  }, [isOpen, availableClasses]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedClassId('');
      setLoading(false);
    }
  }, [isOpen]);

  // Add escape key handler
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        console.log('[TeacherAssignmentModal] Escape key pressed, calling onClose');
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

  const handleAssign = async () => {
    if (!teacher || !selectedClassId) {
      toast.error('Please select a class to assign');
      return;
    }

    const selectedClass = filteredClasses.find(c => c.id === selectedClassId);
    const previousTeacher = selectedClass?.teacher_id ? 
      teachers.find(t => t.id === selectedClass.teacher_id) : null;

    setLoading(true);
    try {
      console.log('[TeacherAssignmentModal] Assigning teacher', teacher.first_name, teacher.last_name, 'to class', selectedClassId);
      
      await classService.updateClass(selectedClassId, {
        teacher_id: teacher.id
      });
      
      // Provide detailed feedback about what happened
      if (previousTeacher && previousTeacher.id !== teacher.id) {
        toast.success(
          `Class reassigned successfully! ${teacher.first_name} ${teacher.last_name} is now the teacher (previously ${previousTeacher.first_name} ${previousTeacher.last_name})`
        );
      } else {
        toast.success(`Successfully assigned ${teacher.first_name} ${teacher.last_name} to the class`);
      }
      
      onAssignmentComplete();
      onClose();
    } catch (error) {
      console.error('Error assigning teacher:', error);
      toast.error('Failed to assign teacher to class');
    } finally {
      setLoading(false);
    }
  };

  const getClassDisplayName = (cls: Class) => {
    const grade = grades.find(g => g.id === cls.grade_id);
    const section = sections.find(s => s.id === cls.section_id);
    const subject = subjects.find(s => s.id === cls.subject_id);
    
    return `${grade?.name || 'Unknown Grade'} - ${section?.name || 'Unknown Section'} - ${subject?.name || 'Unknown Subject'}`;
  };

  const getCurrentTeacher = (teacherId: string) => {
    return teachers.find(t => t.id === teacherId);
  };

  const getClassDetails = (cls: Class) => {
    const grade = grades.find(g => g.id === cls.grade_id);
    const section = sections.find(s => s.id === cls.section_id);
    const subject = subjects.find(s => s.id === cls.subject_id);
    const currentTeacher = getCurrentTeacher(cls.teacher_id);
    
    return {
      grade: grade?.name || 'Unknown',
      section: section?.name || 'Unknown',
      subject: subject?.name || 'Unknown',
      room: cls.room || 'Not specified',
      academicYear: cls.academic_year,
      currentTeacher: currentTeacher ? `${currentTeacher.first_name} ${currentTeacher.last_name}` : 'Unknown Teacher'
    };
  };

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    console.log('[TeacherAssignmentModal] Backdrop clicked, calling onClose');
    onClose();
  };

  const handleCloseClick = () => {
    console.log('[TeacherAssignmentModal] Close button clicked, calling onClose');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Assign Teacher to Class</h2>
              <p className="text-sm text-gray-500">
                Assign {teacher?.first_name} {teacher?.last_name} to a class
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Teacher Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Teacher Information</h3>
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

          {/* Class Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Class to Assign (or Reassign)
            </label>
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Each class can only have one teacher. Selecting a class that already has a teacher will reassign it from the current teacher to {teacher?.first_name} {teacher?.last_name}.
              </p>
            </div>
            
            {filteredClasses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                {!dataLoaded ? (
                  <>
                    <p>Loading classes...</p>
                    <p className="text-sm">Please wait while we fetch available classes.</p>
                  </>
                ) : (
                  <>
                    <p>No classes available</p>
                    <p className="text-sm">Please ensure classes are created first.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {filteredClasses.map((cls) => {
                  const details = getClassDetails(cls);
                  const isCurrentlyAssigned = cls.teacher_id === teacher?.id;
                  return (
                    <div
                      key={cls.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedClassId === cls.id
                          ? 'border-blue-500 bg-blue-50'
                          : isCurrentlyAssigned
                          ? 'border-green-300 bg-green-50 hover:border-green-400'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedClassId(cls.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {getClassDisplayName(cls)}
                            </h4>
                            {isCurrentlyAssigned && (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                Currently Assigned
                              </span>
                            )}
                            {cls.teacher_id && cls.teacher_id !== teacher?.id && (
                              <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                                Will Reassign
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <GraduationCap className="h-4 w-4 mr-1" />
                              Grade: {details.grade}
                            </div>
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              Section: {details.section}
                            </div>
                            <div className="flex items-center">
                              <BookOpen className="h-4 w-4 mr-1" />
                              Subject: {details.subject}
                            </div>
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              Room: {details.room}
                            </div>
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              Current Teacher: {details.currentTeacher}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Academic Year: {details.academicYear}
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedClassId === cls.id
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {selectedClassId === cls.id && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleCloseClick}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedClassId || loading || !dataLoaded}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : !dataLoaded ? 'Loading...' : (() => {
              if (!selectedClassId) return 'Select a Class';
              
              const selectedClass = filteredClasses.find(c => c.id === selectedClassId);
              const isCurrentlyAssigned = selectedClass?.teacher_id === teacher?.id;
              const hasOtherTeacher = selectedClass?.teacher_id && selectedClass.teacher_id !== teacher?.id;
              
              if (isCurrentlyAssigned) {
                return 'Already Assigned';
              } else if (hasOtherTeacher) {
                return 'Reassign Class';
              } else {
                return 'Assign Teacher';
              }
            })()}
          </button>
        </div>
      </div>
    </div>
  );
}