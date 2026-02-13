import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClasses } from '@/hooks/queries/classes';
import { useEnrollmentGrades, useEnrollmentSections, useAcademicYears } from '@/hooks/queries/enrollments';
import { useSubjects } from '@/hooks/queries/subjects';
import { useTeachers } from '@/hooks/queries/teachers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePromotionService } from '@/services/api/promotion-service';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function ClassesOverviewPage() {
  const queryClient = useQueryClient();
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const { data: grades = [] } = useEnrollmentGrades();
  const { data: sections = [] } = useEnrollmentSections();
  const { data: subjects = [] } = useSubjects();
  const { data: teachers = [] } = useTeachers();
  const { data: academicYears = [] } = useAcademicYears();

  const { evaluatePromotion } = usePromotionService();
  const [isEvalOpen, setIsEvalOpen] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');

  const gradeMap = useMemo(() => Object.fromEntries(grades.map(g => [g.id, g.name])), [grades]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map(s => [s.id, s.name])), [sections]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s.name])), [subjects]);
  const teacherMap = useMemo(() => {
    const toName = (t: any) => [t.first_name, t.last_name].filter(Boolean).join(' ') || t.id;
    return Object.fromEntries(teachers.map(t => [t.id, toName(t)]));
  }, [teachers]);

  const formatClassRow = (c: any) =>
    `${gradeMap[c.grade_id] || '—'} - ${sectionMap[c.section_id] || '—'} - ${subjectMap[c.subject_id] || '—'} (${teacherMap[c.teacher_id] || '—'})`;

  const onEvaluate = async () => {
    if (!selectedYearId || !selectedGradeId) {
      toast.error('Select academic year and grade');
      return;
    }
    try {
      const res = await evaluatePromotion(selectedYearId, selectedGradeId);
      toast.success(`Evaluated ${res.length} enrollments`);
      setIsEvalOpen(false);
    } catch {
      toast.error('Failed to evaluate promotions');
    }
  };

  const isLoading = classesLoading; // Aggregate loading or just classes?

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Classes Overview</h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsEvalOpen(true)}>Evaluate Promotions</Button>
          <Button onClick={() => (window.location.href = './new')}>Create Class</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>All Classes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8 animate-pulse text-gray-400">Loading classes...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identity</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{formatClassRow(c)}</TableCell>
                    <TableCell>{c.academic_year}</TableCell>
                    <TableCell>{c.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>{c.room || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => (window.location.href = `./classes/${c.id}`)}>View</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {classes.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-gray-500">No classes found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={isEvalOpen} onOpenChange={setIsEvalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Evaluate Promotions</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Academic Year</label>
              <select className="border rounded p-2 w-full" value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}>
                <option value="">Select year</option>
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Grade</label>
              <select className="border rounded p-2 w-full" value={selectedGradeId} onChange={(e) => setSelectedGradeId(e.target.value)}>
                <option value="">Select grade</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEvalOpen(false)}>Cancel</Button>
              <Button onClick={onEvaluate}>Run Evaluation</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
