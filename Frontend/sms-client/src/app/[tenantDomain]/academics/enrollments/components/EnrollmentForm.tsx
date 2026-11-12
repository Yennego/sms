'use client';

// Enroll a student in a class (an existing student, or a new one created here), or edit an
// enrollment. Shows how full the chosen class is.

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { ENROLLMENT_STATUSES, nameOf } from '@/components/year-end/format';
import {
  useClassCapacity,
  useCreateEnrollment,
  useCreateStudentForEnrollment,
  useSectionsOfGrade,
  useUpdateEnrollment,
} from '@/components/year-end/queries';
import { cn } from '@/lib/utils';
import { AcademicYear, Enrollment, EnrollmentCreate, EnrollmentUpdate, Grade } from '@/types/enrollment';
import { Student } from '@/types/student';

interface EnrollmentFormProps {
  enrollment?: Enrollment;
  students: Student[];
  academicYears: AcademicYear[];
  grades: Grade[];
  currentAcademicYear: AcademicYear | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

type EnrollmentStatus = Enrollment['status'];

const inputClass = 'h-11 text-base md:h-9 md:text-sm';

export default function EnrollmentForm({
  enrollment,
  students,
  academicYears,
  grades,
  currentAcademicYear,
  onSuccess,
  onCancel,
}: EnrollmentFormProps) {
  const [formData, setFormData] = useState({
    student_id: enrollment?.student_id ?? '',
    academic_year_id: enrollment?.academic_year_id ?? currentAcademicYear?.id ?? '',
    grade_id: enrollment?.grade_id ?? '',
    section_id: enrollment?.section_id ?? '',
    semester: enrollment?.semester ?? 1,
    enrollment_date: enrollment?.enrollment_date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    status: (enrollment?.status ?? 'active') as EnrollmentStatus,
  });
  const [creatingNewStudent, setCreatingNewStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '', email: '', admission_number: '' });
  // Set when the server enrolled a newly created student by itself: nothing more is created
  const [autoEnrolled, setAutoEnrolled] = useState<Enrollment | null>(null);

  const createEnrollment = useCreateEnrollment();
  const updateEnrollment = useUpdateEnrollment();
  const createStudent = useCreateStudentForEnrollment();
  const isSubmitting = createEnrollment.isPending || updateEnrollment.isPending || createStudent.isPending;

  const sectionsQuery = useSectionsOfGrade(formData.grade_id);
  const sections = Array.isArray(sectionsQuery.data) ? sectionsQuery.data : [];
  const capacity = useClassCapacity(formData.academic_year_id, formData.grade_id, formData.section_id);

  const set = (patch: Partial<typeof formData>) => setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.academic_year_id || !formData.grade_id || !formData.section_id) {
      notify.error('Choose a school year, grade and section.');
      return;
    }
    if (sections.length === 0) {
      notify.error('This grade has no sections. Add a section first.');
      return;
    }
    const yearName = academicYears.find((y) => y.id === formData.academic_year_id)?.name;
    const gradeName = grades.find((g) => g.id === formData.grade_id)?.name;
    const sectionName = sections.find((s) => s.id === formData.section_id)?.name;
    if (!yearName || !gradeName || !sectionName) {
      notify.error('Choose a school year, grade and section.');
      return;
    }

    try {
      if (enrollment) {
        const payload: EnrollmentUpdate = {
          academic_year_id: formData.academic_year_id,
          grade_id: formData.grade_id,
          section_id: formData.section_id,
          semester: formData.semester,
          enrollment_date: formData.enrollment_date,
          status: formData.status,
        };
        await updateEnrollment.mutateAsync({ id: enrollment.id, data: payload });
        notify.success('Enrollment saved.');
        onSuccess();
        return;
      }

      let studentId = formData.student_id;
      if (creatingNewStudent || !studentId) {
        if (!newStudent.first_name || !newStudent.last_name || !newStudent.email) {
          notify.error('Enter the first name, last name and email.');
          return;
        }
        let created;
        try {
          created = await createStudent.mutateAsync({
            firstName: newStudent.first_name,
            lastName: newStudent.last_name,
            email: newStudent.email,
            admission_number: newStudent.admission_number || undefined,
          } as Parameters<typeof createStudent.mutateAsync>[0]);
        } catch (err) {
          notify.error(errorMessage(err, "The student wasn't created. Check the details and try again."));
          setCreatingNewStudent(false);
          return;
        }
        studentId = created.student.id;
        notify.success(`${created.student.firstName} ${created.student.lastName} is added.`);

        const auto = created.autoEnrollment;
        if (auto) {
          setAutoEnrolled(auto);
          notify.info('The student is enrolled already', {
            description: `In ${nameOf(auto.grade)} - ${nameOf(auto.section)} for ${nameOf(auto.academic_year)}.`,
          });
          // Short delay so the message is seen before the dialog closes
          setTimeout(onSuccess, 500);
          return;
        }
      }

      if (!studentId) {
        notify.error('Choose a student.');
        return;
      }
      const payload: EnrollmentCreate = {
        student_id: studentId,
        academic_year_id: formData.academic_year_id,
        grade_id: formData.grade_id,
        section_id: formData.section_id,
        semester: formData.semester,
        enrollment_date: formData.enrollment_date,
        status: formData.status === 'inactive' ? 'inactive' : 'active',
      };
      await createEnrollment.mutateAsync(payload);
      notify.success(`Student enrolled in ${gradeName} - ${sectionName}.`);
      onSuccess();
    } catch (error) {
      notify.error(errorMessage(error, "The enrollment wasn't saved. Try again."));
    }
  };

  const hasSelections =
    !!formData.academic_year_id && !!formData.grade_id && sections.length > 0 && !!formData.section_id;
  const newStudentValid = !!newStudent.first_name && !!newStudent.last_name && !!newStudent.email;
  const canSubmit =
    !isSubmitting && hasSelections && !autoEnrolled && (creatingNewStudent ? newStudentValid : !!formData.student_id);

  const submitLabel = autoEnrolled
    ? 'Already enrolled'
    : enrollment
      ? 'Save changes'
      : creatingNewStudent
        ? 'Add student and enroll'
        : 'Enroll student';

  const full = capacity.data ? capacity.data.count >= capacity.data.capacity : false;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
          <FormField label="Student" required={!creatingNewStudent}>
            <select
              className={selectClass}
              value={formData.student_id}
              onChange={(e) => set({ student_id: e.target.value })}
              disabled={!!enrollment || creatingNewStudent}
            >
              <option value="">{creatingNewStudent ? 'Adding a new student below' : 'Choose a student'}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                  {s.admission_number ? ` (${s.admission_number})` : ''}
                </option>
              ))}
            </select>
          </FormField>
          {!enrollment ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 self-start md:min-h-9"
              onClick={() => {
                setCreatingNewStudent((prev) => !prev);
                set({ student_id: '' });
              }}
            >
              {creatingNewStudent ? 'Choose an existing student' : 'Add a new student'}
            </Button>
          ) : null}
        </div>

        {!enrollment && creatingNewStudent ? (
          <fieldset className="grid gap-4 rounded-xl border p-4 md:col-span-2 md:grid-cols-2">
            <legend className="px-1 text-sm font-medium">New student</legend>
            <FormField label="First name" required>
              <Input
                className={inputClass}
                value={newStudent.first_name}
                onChange={(e) => setNewStudent((p) => ({ ...p, first_name: e.target.value }))}
              />
            </FormField>
            <FormField label="Last name" required>
              <Input
                className={inputClass}
                value={newStudent.last_name}
                onChange={(e) => setNewStudent((p) => ({ ...p, last_name: e.target.value }))}
              />
            </FormField>
            <FormField label="Email" required>
              <Input
                type="email"
                className={inputClass}
                value={newStudent.email}
                onChange={(e) => setNewStudent((p) => ({ ...p, email: e.target.value }))}
              />
            </FormField>
            <FormField label="Admission number" description="Leave empty to have one given.">
              <Input
                className={inputClass}
                value={newStudent.admission_number}
                onChange={(e) => setNewStudent((p) => ({ ...p, admission_number: e.target.value }))}
              />
            </FormField>
          </fieldset>
        ) : null}

        <FormField label="School year" required>
          <select
            className={selectClass}
            value={formData.academic_year_id}
            onChange={(e) => set({ academic_year_id: e.target.value })}
          >
            <option value="">Choose a school year</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.is_current ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Grade" required>
          <select
            className={selectClass}
            value={formData.grade_id}
            onChange={(e) => set({ grade_id: e.target.value, section_id: '' })}
            disabled={!!autoEnrolled}
          >
            <option value="">Choose a grade</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Section"
          required
          description={
            autoEnrolled
              ? `Enrolled by the server in ${nameOf(autoEnrolled.grade)} - ${nameOf(autoEnrolled.section)}.`
              : !formData.grade_id
                ? 'Choose a grade to see its sections.'
                : !sectionsQuery.isLoading && sections.length === 0
                  ? 'This grade has no sections yet.'
                  : undefined
          }
        >
          <select
            className={selectClass}
            value={formData.section_id}
            onChange={(e) => set({ section_id: e.target.value })}
            disabled={!!autoEnrolled || !formData.grade_id || sectionsQuery.isLoading || sections.length === 0}
          >
            <option value="">{sectionsQuery.isLoading ? 'Loading sections…' : 'Choose a section'}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>

        <div className="flex items-end">
          {capacity.isFetching ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Checking how full the class is…
            </p>
          ) : capacity.data ? (
            <p role="status" className={cn('text-sm font-medium', full ? 'text-red-700' : 'text-green-700')}>
              {capacity.data.count} of {capacity.data.capacity} places taken
              {full ? ': the class is full' : ''}
            </p>
          ) : null}
        </div>

        <FormField label="Semester" required>
          <select
            className={selectClass}
            value={String(formData.semester)}
            onChange={(e) => set({ semester: parseInt(e.target.value, 10) })}
          >
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
        </FormField>

        <FormField label="Enrollment date" required>
          <Input
            type="date"
            className={inputClass}
            value={formData.enrollment_date}
            onChange={(e) => set({ enrollment_date: e.target.value })}
          />
        </FormField>

        {enrollment ? (
          <FormField label="Status" className="md:col-span-2">
            <select
              className={selectClass}
              value={formData.status}
              onChange={(e) => set({ status: e.target.value as EnrollmentStatus })}
            >
              {ENROLLMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="min-h-11 md:min-h-9" disabled={!canSubmit}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
