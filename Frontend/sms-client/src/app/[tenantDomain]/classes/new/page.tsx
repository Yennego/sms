'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAcademicGradeService } from '@/services/api/academic-grade-service';
import { useSectionService } from '@/services/api/section-service';
import { useSubjectService } from '@/services/api/subject-service';
import { useTeacherService } from '@/services/api/teacher-service';
import { useClassService } from '@/services/api/class-service';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import type { AcademicGrade } from '@/types/academic-grade';
import type { Section } from '@/types/section';
import type { Subject } from '@/types/subject';
import type { Teacher } from '@/types/teacher';
import type { ClassCreate } from '@/types/class';

export default function ClassBuilderPage() {
  const gradeService = useAcademicGradeService();
  const sectionService = useSectionService();
  const subjectService = useSubjectService();
  const teacherService = useTeacherService();
  const classService = useClassService();
  const enrollmentService = useEnrollmentService();

  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [currentYearName, setCurrentYearName] = useState<string>('');

  const [step, setStep] = useState<number>(0);
  const [form, setForm] = useState<{
    academic_year: string;
    grade_id: string;
    section_id: string;
    subject_id: string;
    teacher_id: string;
    name?: string;
    room?: string;
    is_active: boolean;
    start_date: string;
    end_date?: string;
    description?: string;
  }>({
    academic_year: '',
    grade_id: '',
    section_id: '',
    subject_id: '',
    teacher_id: '',
    name: '',
    room: '',
    is_active: true,
    start_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    async function boot() {
      const [g, s, sub, t, year] = await Promise.all([
        gradeService.getAllGrades(),
        sectionService.getSections().then(r => r?.sections ?? []),
        subjectService.getAllSubjects(),
        teacherService.getTeachers(),
        enrollmentService.getCurrentAcademicYear()
      ]);
      setGrades(g || []);
      setSections(s || []);
      setSubjects(sub || []);
      setTeachers(t || []);
      const yearName = year?.name || '';
      setCurrentYearName(yearName);
      setForm(prev => ({ ...prev, academic_year: yearName }));
    }
    boot();
  }, []);

  const next = () => setStep(s => Math.min(s + 1, 4));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const canNext = useMemo(() => {
    if (step === 0) return !!form.grade_id && !!form.section_id;
    if (step === 1) return !!form.subject_id;
    if (step === 2) return !!form.teacher_id;
    if (step === 3) return !!form.academic_year && !!form.start_date;
    return true;
  }, [step, form]);

  const handleCreate = async () => {
    const payload: ClassCreate = {
      academic_year: form.academic_year,
      grade_id: form.grade_id,
      section_id: form.section_id,
      subject_id: form.subject_id,
      teacher_id: form.teacher_id,
      is_active: form.is_active,
      start_date: form.start_date,
      end_date: form.end_date,
      name: form.name,
      room: form.room,
      description: form.description
    };
    await classService.buildClass(payload);
    // Simple UX: redirect to classes overview
    window.location.href = '../classes';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Class Builder</h1>
        <Button variant="outline" onClick={() => (window.location.href = '../classes')}>Back to Overview</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step {step + 1} of 5</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Grade</label>
                <Select value={form.grade_id} onValueChange={(v) => setForm(prev => ({ ...prev, grade_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                  <SelectContent>
                    {grades.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Section</label>
                <Select value={form.section_id} onValueChange={(v) => setForm(prev => ({ ...prev, section_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Select value={form.subject_id} onValueChange={(v) => setForm(prev => ({ ...prev, subject_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="text-sm font-medium">Teacher</label>
              <Select value={form.teacher_id} onValueChange={(v) => setForm(prev => ({ ...prev, teacher_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => {
                    const name = [t.first_name, t.last_name].filter(Boolean).join(' ') || t.id;
                    return <SelectItem key={t.id} value={t.id}>{name}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Academic Year</label>
                <Input value={form.academic_year || currentYearName || ''} disabled />
              </div>
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input type="date" value={form.end_date || ''} onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))} />
              </div>
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input value={form.name || ''} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Room</label>
                  <Input value={form.room || ''} onChange={(e) => setForm(prev => ({ ...prev, room: e.target.value }))} />
                </div>
                <div className="flex items-end">
                  <Button variant={form.is_active ? 'default' : 'outline'} onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}>
                    {form.is_active ? 'Active' : 'Inactive'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2">
              <p><strong>Grade:</strong> {grades.find(g => g.id === form.grade_id)?.name || '—'}</p>
              <p><strong>Section:</strong> {sections.find(s => s.id === form.section_id)?.name || '—'}</p>
              <p><strong>Subject:</strong> {subjects.find(s => s.id === form.subject_id)?.name || '—'}</p>
              <p><strong>Teacher:</strong> {teachers.find(t => t.id === form.teacher_id) ? [teachers.find(t => t.id === form.teacher_id)?.first_name, teachers.find(t => t.id === form.teacher_id)?.last_name].filter(Boolean).join(' ') : '—'}</p>
              <p><strong>Academic Year:</strong> {form.academic_year || '—'}</p>
              <p><strong>Start:</strong> {form.start_date || '—'} <strong>End:</strong> {form.end_date || '—'}</p>
              <p><strong>Name:</strong> {form.name || '—'} <strong>Room:</strong> {form.room || '—'} <strong>Status:</strong> {form.is_active ? 'Active' : 'Inactive'}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={back}>Back</Button>
                <Button onClick={handleCreate}>Create Class</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0}>Back</Button>
        <Button onClick={next} disabled={!canNext || step === 4}>{step === 4 ? 'Done' : 'Next'}</Button>
      </div>
    </div>
  );
}