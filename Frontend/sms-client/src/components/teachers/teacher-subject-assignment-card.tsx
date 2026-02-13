import React from 'react';
import { Teacher } from '@/types/teacher';
import { TeacherSubjectAssignment } from '@/types/teacher-subject-assignment';
import { Subject } from '@/types/subject';
import { AcademicGrade } from '@/types/academic-grade';
import { Section } from '@/types/section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Calendar, MapPin, Edit, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Checkbox } from '@/components/ui/checkbox';
import { LayoutGrid, List } from 'lucide-react';

interface TeacherSubjectAssignmentCardProps {
  teacher: Teacher;
  assignments: TeacherSubjectAssignment[];
  subjects: Subject[];
  grades: AcademicGrade[];
  sections: Section[];
  onAssignSubjects: (teacher: Teacher) => void;
  onEditAssignment?: (assignment: TeacherSubjectAssignment) => void;
  onDeleteAssignment?: (assignment: TeacherSubjectAssignment) => void;
  onViewStudents?: (assignment: TeacherSubjectAssignment) => void;
  selectedIdsSet?: Set<string>;
  onSelectAssignment?: (id: string, checked: boolean) => void;
  onSelectAllAssignments?: (ids: string[], checked: boolean) => void;
}

export const TeacherSubjectAssignmentCard: React.FC<TeacherSubjectAssignmentCardProps> = React.memo(({
  teacher,
  assignments,
  subjects,
  grades,
  sections,
  onAssignSubjects,
  onEditAssignment,
  onDeleteAssignment,
  onViewStudents,
  selectedIdsSet = new Set(),
  onSelectAssignment,
  onSelectAllAssignments,
}) => {
  const [viewType, setViewType] = React.useState<'grid' | 'table'>('table');
  const [localSearch, setLocalSearch] = React.useState('');
  const { user } = useAuth();
  const hasPermission = (permission: string) => user?.permissions?.includes(permission) || false;

  const getSubjectName = (a: any) => a.subject_name || subjects.find(s => s.id === a.subject_id)?.name || 'Unknown Subject';
  const getGradeName = (a: any) => a.grade_name || grades.find(g => g.id === a.grade_id)?.name || 'Unknown Grade';
  const getSectionName = (a: any) => a.section_name || sections.find(s => s.id === a.section_id)?.name || 'Unknown Section';

  const filteredAssignments = React.useMemo(() => {
    if (!localSearch) return assignments;
    const search = localSearch.toLowerCase();
    return assignments.filter(a =>
      getSubjectName(a).toLowerCase().includes(search) ||
      getGradeName(a).toLowerCase().includes(search) ||
      getSectionName(a).toLowerCase().includes(search)
    );
  }, [assignments, localSearch, subjects, grades, sections]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              {teacher.first_name} {teacher.last_name}
            </CardTitle>
            <CardDescription>
              {teacher.email} • {teacher.employee_id}
              {teacher.department && ` • ${teacher.department}`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={teacher.status === 'active' ? 'default' : 'secondary'}>
              {teacher.status}
            </Badge>
            {teacher.is_class_teacher && (
              <Badge variant="outline">Class Teacher</Badge>
            )}
            {teacher.status === 'active' && hasPermission('manage_teacher_assignments') && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => onAssignSubjects(teacher)}
              >
                <BookOpen className="h-3 w-3 mr-1" />
                Assign Subjects
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h4 className="font-medium flex items-center shrink-0">
              <BookOpen className="h-4 w-4 mr-2 text-blue-500" />
              Allocated Subjects ({assignments.length})
            </h4>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Local Search */}
              <div className="relative flex-1 sm:w-48">
                <input
                  type="text"
                  placeholder="Filter subjects..."
                  className="w-full h-8 px-8 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                />
                <BookOpen className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              </div>

              {/* View Toggle */}
              <div className="flex bg-gray-100 p-0.5 rounded-md">
                <Button
                  size="sm"
                  variant={viewType === 'grid' ? 'secondary' : 'ghost'}
                  className="h-7 w-7 p-0"
                  onClick={() => setViewType('grid')}
                  title="Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={viewType === 'table' ? 'secondary' : 'ghost'}
                  className="h-7 w-7 p-0"
                  onClick={() => setViewType('table')}
                  title="Table View"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>

              {assignments.length > 0 && onSelectAssignment && (
                <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border rounded-md">
                  <Checkbox
                    id={`select-all-${teacher.id}`}
                    checked={assignments.length > 0 && assignments.every(a => selectedIdsSet.has(a.id))}
                    onCheckedChange={(checked) => {
                      if (onSelectAllAssignments) {
                        onSelectAllAssignments(assignments.map(a => a.id), !!checked);
                      } else if (onSelectAssignment) {
                        assignments.forEach(a => onSelectAssignment(a.id, !!checked));
                      }
                    }}
                  />
                  <label htmlFor={`select-all-${teacher.id}`} className="text-[10px] font-medium text-gray-500 cursor-pointer uppercase tracking-wider">
                    Bulk
                  </label>
                </div>
              )}
            </div>
          </div>
          {assignments.length === 0 ? (
            <p className="text-gray-500 text-sm italic py-4">No subject assignments found.</p>
          ) : viewType === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAssignments.map((assignment) => (
                <div
                  key={assignment.id || `${assignment.grade_id}-${assignment.section_id}-${assignment.subject_id}`}
                  className={`border rounded-lg p-3 transition-all ${selectedIdsSet.has(assignment.id)
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-white hover:border-gray-300'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-2">
                      {onSelectAssignment && (
                        <div className="pt-0.5">
                          <Checkbox
                            id={`select-${assignment.id}`}
                            checked={selectedIdsSet.has(assignment.id)}
                            onCheckedChange={(checked) => onSelectAssignment(assignment.id, !!checked)}
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-sm text-gray-900">{getSubjectName(assignment)}</p>
                        <p className="text-xs text-gray-500 font-medium">
                          {getGradeName(assignment)} • {getSectionName(assignment)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {onViewStudents && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => onViewStudents(assignment)}
                          title="View Students"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                      {onEditAssignment && hasPermission('manage_teacher_assignments') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-gray-100"
                          onClick={() => onEditAssignment(assignment)}
                        >
                          <Edit className="h-4 w-4 text-gray-400" />
                        </Button>
                      )}
                      {onDeleteAssignment && hasPermission('manage_teacher_assignments') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => onDeleteAssignment(assignment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  <tr>
                    {onSelectAssignment && <th className="px-4 py-3 w-10"></th>}
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Grade & Section</th>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssignments.map((assignment) => (
                    <tr
                      key={assignment.id || `${assignment.grade_id}-${assignment.section_id}-${assignment.subject_id}`}
                      className={`hover:bg-blue-50/30 transition-colors ${selectedIdsSet.has(assignment.id) ? 'bg-blue-50/50' : ''}`}
                    >
                      {onSelectAssignment && (
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIdsSet.has(assignment.id)}
                            onCheckedChange={(checked) => onSelectAssignment(assignment.id, !!checked)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-gray-900">{getSubjectName(assignment)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {getGradeName(assignment)} - {getSectionName(assignment)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{assignment.room || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={assignment.is_active ? 'default' : 'secondary'} className="text-[10px] h-5">
                          {assignment.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {onViewStudents && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500" onClick={() => onViewStudents(assignment)}>
                              <Users className="h-4 w-4" />
                            </Button>
                          )}
                          {onEditAssignment && hasPermission('manage_teacher_assignments') && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEditAssignment(assignment)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {onDeleteAssignment && hasPermission('manage_teacher_assignments') && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => onDeleteAssignment(assignment)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  if (prevProps.teacher !== nextProps.teacher) return false;
  if (prevProps.assignments !== nextProps.assignments) return false;
  if (prevProps.subjects !== nextProps.subjects) return false;
  if (prevProps.grades !== nextProps.grades) return false;
  if (prevProps.sections !== nextProps.sections) return false;
  if (prevProps.onAssignSubjects !== nextProps.onAssignSubjects) return false;
  if (prevProps.onEditAssignment !== nextProps.onEditAssignment) return false;
  if (prevProps.onDeleteAssignment !== nextProps.onDeleteAssignment) return false;
  if (prevProps.onViewStudents !== nextProps.onViewStudents) return false;
  if (prevProps.onSelectAssignment !== nextProps.onSelectAssignment) return false;
  if (prevProps.onSelectAllAssignments !== nextProps.onSelectAllAssignments) return false;

  return prevProps.assignments.every(a =>
    prevProps.selectedIdsSet?.has(a.id) === nextProps.selectedIdsSet?.has(a.id)
  );
});
