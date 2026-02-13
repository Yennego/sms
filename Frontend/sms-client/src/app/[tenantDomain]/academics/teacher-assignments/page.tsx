'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Teacher } from '@/types/teacher';
import { Class } from '@/types/class';
import { ClassSubjectAssignment, TeacherSubjectAssignment } from '@/types/teacher-subject-assignment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Filter, Users, BookOpen, GraduationCap, Building2, UserPlus, Loader2, Calendar, RefreshCw, AlertCircle
} from 'lucide-react';
import { TeacherAssignmentModal } from '@/components/common/TeacherAssignmentModal';
import { TeacherSubjectAssignmentModal } from '@/components/common/TeacherSubjectAssignmentModal';
import { EditTeacherAssignmentModal } from '@/components/common/EditTeacherAssignmentModal';
import { TeacherSubjectAssignmentCard } from '@/components/teachers/teacher-subject-assignment-card';
import { ClassSponsorGrid } from '@/components/teachers/class-sponsor-grid';
import { AssignSponsorModal } from '@/components/teachers/assign-sponsor-modal';
import { ClassRosterModal } from '@/components/common/ClassRosterModal';
import { SubjectAssignmentGrid } from '@/components/teachers/subject-assignment-grid';
import { toast } from 'sonner';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useTeachers } from '@/hooks/queries/teachers';
import { useClasses } from '@/hooks/queries/classes';
import { useSubjects } from '@/hooks/queries/subjects';
import { useEnrollmentGrades, useEnrollmentSections, useAcademicYears } from '@/hooks/queries/enrollments';
import {
  useAllTeacherAssignments,
  useBulkDeleteAssignments,
  useBulkReassignAssignments,
  useDeleteAssignment,
  useCreateAssignment,
  useUnassignedSubjects,
  useClassSponsors
} from '@/hooks/queries/teacher-assignments';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function TeacherAssignmentsPage() {
  const { selectedAcademicYearName, selectedAcademicYearId } = useAcademicYear();
  const currentYear = selectedAcademicYearName || '';

  // 1. TanStack Queries
  const { data: teachers = [], isLoading: teachersLoading } = useTeachers();
  const { data: classes = [], isLoading: classesLoading } = useClasses({ academic_year_id: selectedAcademicYearId || undefined });
  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { data: grades = [], isLoading: gradesLoading } = useEnrollmentGrades();
  const { data: sections = [], isLoading: sectionsLoading } = useEnrollmentSections();
  const { data: allAssignments = [], isLoading: assignmentsLoading } = useAllTeacherAssignments(selectedAcademicYearId || '');
  const { data: unassignedSubjects = [], isLoading: unassignedLoading } = useUnassignedSubjects(selectedAcademicYearId || '');
  const { data: sponsors = [], isLoading: sponsorsLoading } = useClassSponsors(selectedAcademicYearId || '');
  const { data: academicYears = [] } = useAcademicYears();

  // 2. Mutations
  const deleteMutation = useDeleteAssignment();
  const createMutation = useCreateAssignment();
  const bulkDeleteMutation = useBulkDeleteAssignments();
  const bulkReassignMutation = useBulkReassignAssignments();

  // 3. Local UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'class' | 'subject' | 'allocation'>('subject');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [subjectAssignmentModalOpen, setSubjectAssignmentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState<TeacherSubjectAssignment | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [targetReassignTeacher, setTargetReassignTeacher] = useState<string>('');

  // Sponsors UI state
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionName, setSelectedSectionName] = useState('');
  const [currentSponsorId, setCurrentSponsorId] = useState<string | null>(null);

  // 4. Derived Data
  const teacherNameMap = useMemo(() =>
    Object.fromEntries(teachers.map(t => [t.id, `${t.first_name} ${t.last_name}`])),
    [teachers]);

  const teacherAssignmentsMap = useMemo(() => {
    const map = new Map<string, TeacherSubjectAssignment[]>();
    allAssignments.forEach(a => {
      // Backend returns stringified IDs. Use normalized IDs for matching
      const teacherId = a.teacher_id?.toLowerCase().trim();
      if (teacherId) {
        const existing = map.get(teacherId) || [];
        map.set(teacherId, [...existing, a as any]);
      }
    });
    return map;
  }, [allAssignments]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t =>
      !searchTerm ||
      `${t.first_name} ${t.last_name} ${t.email} ${t.employee_id}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teachers, searchTerm]);

  // Enriched available assignments for modal (assigned + unassigned slots)
  const availableSubjectAssignments = useMemo(() => {
    if (assignmentsLoading || unassignedLoading) return [];

    // Map existing assignments to the format expected by the modal
    const assignedSlots: ClassSubjectAssignment[] = allAssignments.map(a => {
      const gName = a.grade_name || grades.find(g => g.id === a.grade_id)?.name || 'Unknown Grade';
      const sName = a.section_name || sections.find(s => s.id === a.section_id)?.name || 'Unknown Section';
      const subName = a.subject_name || subjects.find(s => s.id === a.subject_id)?.name || 'Unknown Subject';

      return {
        ...a,
        grade_name: gName,
        section_name: sName,
        subject_name: subName,
        class_name: a.class_name || a.name || `${subName} - ${gName}${sName}`,
        is_assigned: true
      };
    });

    // Enforce name consistency for unassigned subjects too
    const unassignedSlots: ClassSubjectAssignment[] = unassignedSubjects.map(u => {
      const gName = u.grade_name || grades.find(g => g.id === u.grade_id)?.name || 'Unknown Grade';
      const sName = u.section_name || sections.find(s => s.id === u.section_id)?.name || 'Unknown Section';
      const subName = u.subject_name || subjects.find(s => s.id === u.subject_id)?.name || 'Unknown Subject';

      return {
        ...u,
        grade_name: gName,
        section_name: sName,
        subject_name: subName,
        class_name: u.class_name || `${subName} - ${gName}${sName}`,
        is_assigned: false
      };
    });

    return [...assignedSlots, ...unassignedSlots];
  }, [allAssignments, unassignedSubjects, assignmentsLoading, unassignedLoading]);

  // 5. Handlers
  const handleEditAssignment = (assignment: TeacherSubjectAssignment) => {
    setAssignmentToEdit(assignment);
    setEditModalOpen(true);
  };

  const handleUnassignSubject = async (assignment: ClassSubjectAssignment) => {
    if (!assignment.id) return;
    if (confirm(`Are you sure you want to unassign ${assignment.teacher_name} from ${assignment.class_name}?`)) {
      try {
        await deleteMutation.mutateAsync(assignment.id);
        toast.success('Subject unassigned successfully');
      } catch (err) {
        toast.error('Failed to unassign subject');
      }
    }
  };

  const handleOpenAssignmentDialog = (assignment: ClassSubjectAssignment) => {
    setSelectedAssignment(assignment);
    setIsReassignDialogOpen(true);
    setTargetReassignTeacher(assignment.teacher_id || '');
  };

  const handleBulkReassign = async () => {
    if (!targetReassignTeacher || (selectedAssignmentIds.length === 0 && !selectedAssignment)) return;

    try {
      if (selectedAssignment) {
        if (selectedAssignment.id) {
          // Reassign existing
          await bulkReassignMutation.mutateAsync({
            ids: [selectedAssignment.id],
            newTeacherId: targetReassignTeacher
          });
          toast.success('Subject reassigned successfully');
        } else {
          // Create new assignment for vacant slot
          await createMutation.mutateAsync({
            teacher_id: targetReassignTeacher,
            grade_id: selectedAssignment.grade_id,
            section_id: selectedAssignment.section_id,
            subject_id: selectedAssignment.subject_id,
            academic_year_id: selectedAcademicYearId || '',
            is_active: true,
            start_date: new Date().toISOString().split('T')[0]
          });
          toast.success('Subject assigned successfully');
        }
        setSelectedAssignment(null);
      } else {
        // Bulk reassign
        await bulkReassignMutation.mutateAsync({
          ids: selectedAssignmentIds,
          newTeacherId: targetReassignTeacher
        });
        toast.success('Assignments updated');
        setSelectedAssignmentIds([]);
      }
      setIsReassignDialogOpen(false);
    } catch (err) {
      toast.error('Failed to update assignment');
    }
  };

  const isLoading = teachersLoading || assignmentsLoading || unassignedLoading || subjectsLoading || gradesLoading || sectionsLoading || sponsorsLoading;

  const handleOpenSponsorModal = (sectionId: string, currentId: string | null) => {
    const sponsor = sponsors.find(s => s.section_id === sectionId);
    setSelectedSectionId(sectionId);
    setSelectedSectionName(sponsor ? `${sponsor.grade_name} - ${sponsor.section_name}` : 'Unknown Section');
    setCurrentSponsorId(currentId);
    setSponsorModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Teacher Assignments</h1>
          <p className="text-muted-foreground mt-1">Manage subject teachers and class sponsors for {currentYear}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'subject' ? 'default' : 'outline'}
            onClick={() => setViewMode('subject')}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            By Teacher
          </Button>
          <Button
            variant={viewMode === 'allocation' ? 'default' : 'outline'}
            onClick={() => setViewMode('allocation')}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            All Subjects
          </Button>
          <Button
            variant={viewMode === 'class' ? 'default' : 'outline'}
            onClick={() => setViewMode('class')}
          >
            <Users className="h-4 w-4 mr-2" />
            Class Sponsors
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search teachers by name, email or ID..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {selectedAssignmentIds.length > 0 && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-right-4">
                  <Button variant="outline" size="sm" onClick={() => setIsReassignDialogOpen(true)}>
                    Reassign ({selectedAssignmentIds.length})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => {
                    if (confirm(`Delete ${selectedAssignmentIds.length} assignments?`)) {
                      bulkDeleteMutation.mutate(selectedAssignmentIds, {
                        onSuccess: () => setSelectedAssignmentIds([])
                      });
                    }
                  }}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-gray-500 animate-pulse">Synchronizing assignments...</p>
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                <p>No teachers matching your criteria</p>
              </div>
            ) : viewMode === 'subject' ? (
              <div className="space-y-4">
                {filteredTeachers.map(teacher => (
                  <TeacherSubjectAssignmentCard
                    key={teacher.id}
                    teacher={teacher}
                    assignments={teacherAssignmentsMap.get(teacher.id.toLowerCase().trim()) || []}
                    subjects={subjects}
                    grades={grades as any[]}
                    sections={sections as any[]}
                    onAssignSubjects={(t: Teacher) => {
                      setSelectedTeacher(t);
                      setSubjectAssignmentModalOpen(true);
                    }}
                    onEditAssignment={handleEditAssignment}
                    onDeleteAssignment={(a: TeacherSubjectAssignment) => handleUnassignSubject(a as any)}
                    onViewStudents={(a: TeacherSubjectAssignment) => {
                      setSelectedAssignment(a);
                      setRosterModalOpen(true);
                    }}
                    selectedIdsSet={new Set(selectedAssignmentIds)}
                    onSelectAssignment={(id: string, checked: boolean) => {
                      setSelectedAssignmentIds(prev =>
                        checked ? [...prev, id] : prev.filter(x => x !== id)
                      );
                    }}
                  />
                ))}
              </div>
            ) : viewMode === 'allocation' ? (
              <SubjectAssignmentGrid
                assignments={availableSubjectAssignments}
                teachers={teachers}
                isLoading={isLoading}
                searchTerm={searchTerm}
                onAssign={handleOpenAssignmentDialog}
                onUnassign={handleUnassignSubject}
              />
            ) : (
              <ClassSponsorGrid
                sponsors={sponsors}
                teachers={teachers}
                isLoading={sponsorsLoading}
                onAssignSponsor={handleOpenSponsorModal}
                searchTerm={searchTerm}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Assignment Stats</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Total Teachers</span>
                <span className="font-bold">{teachers.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Assigned Slots</span>
                <span className="font-bold">{allAssignments.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-green-600 font-medium">
                <span className="text-gray-500">Subject Coverage</span>
                <span>{Math.round((allAssignments.length / Math.max(1, teachers.length)) * 10) / 10} avg/teacher</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                Smart Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-blue-700 space-y-2">
              <p>All data is automatically synchronized across departments. Assignments made here will instantly reflect in the schedule and gradebook.</p>
              <p className="font-medium">Pro-tip: A teacher can be assigned to multiple subjects across different classes simultaneously.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedTeacher && (
        <TeacherSubjectAssignmentModal
          isOpen={subjectAssignmentModalOpen}
          onClose={() => setSubjectAssignmentModalOpen(false)}
          teacher={selectedTeacher}
          availableAssignments={availableSubjectAssignments}
          grades={grades as any[]}
          sections={sections as any[]}
          subjects={subjects}
          teachers={teachers}
          academicYearId={selectedAcademicYearId || ''}
          onAssignmentComplete={() => { }} // TanStack handles invalidation
        />
      )}

      {assignmentToEdit && (
        <EditTeacherAssignmentModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setAssignmentToEdit(null);
          }}
          assignment={assignmentToEdit}
          teacherName={teacherNameMap[assignmentToEdit.teacher_id] || 'Unknown Teacher'}
          subjectName={subjects.find(s => s.id === assignmentToEdit.subject_id)?.name || 'Unknown Subject'}
          className={`${grades.find(g => g.id === assignmentToEdit.grade_id)?.name || ''} - ${sections.find(s => s.id === assignmentToEdit.section_id)?.name || ''}`}
        />
      )}

      <ClassRosterModal
        isOpen={rosterModalOpen}
        onClose={() => setRosterModalOpen(false)}
        classId={selectedAssignment?.id || null}
        className={selectedAssignment?.class_name || ''}
        teacherName={selectedAssignment?.teacher_name}
      />

      <AssignSponsorModal
        isOpen={sponsorModalOpen}
        onClose={() => setSponsorModalOpen(false)}
        sectionId={selectedSectionId}
        sectionName={selectedSectionName}
        currentTeacherId={currentSponsorId}
        teachers={teachers}
      />

      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAssignment ? 'Assign Teacher' : 'Bulk Reassign'}</DialogTitle>
            <DialogDescription>
              {selectedAssignment
                ? `Assign a teacher to ${selectedAssignment.class_name}`
                : `Move ${selectedAssignmentIds.length} assignments to another teacher.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Teacher</Label>
              <Select value={targetReassignTeacher} onValueChange={setTargetReassignTeacher}>
                <SelectTrigger><SelectValue placeholder="Select teacher..." /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsReassignDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkReassign}>Reassign Now</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
