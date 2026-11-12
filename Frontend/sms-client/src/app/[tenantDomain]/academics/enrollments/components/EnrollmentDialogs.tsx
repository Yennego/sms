'use client';

// The enrollment dialogs: enroll one student, enroll from a file, edit, promote one student and
// transfer a student out. The class pages open Promote and Transfer through the ref.

import React from 'react';

import { selectClass } from '@/components/students/admission-form';
import { errorMessage, formatDate } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { studentLabel } from '@/components/year-end/format';
import { usePromoteEnrollment, useTransferEnrollment } from '@/components/year-end/queries';
import { AcademicYear, Enrollment, Grade, Section } from '@/types/enrollment';
import { Student } from '@/types/student';
import BulkEnrollmentForm from './BulkEnrollmentForm';
import EnrollmentForm from './EnrollmentForm';

interface Props {
  showCreateDialog: boolean;
  setShowCreateDialog: (v: boolean) => void;
  showBulkDialog: boolean;
  setShowBulkDialog: (v: boolean) => void;
  editingEnrollment: Enrollment | null;
  setEditingEnrollment: (e: Enrollment | null) => void;
  students: Student[];
  academicYears: AcademicYear[];
  grades: Grade[];
  sections: Section[];
  currentAcademicYear: AcademicYear | null;
  onSuccess: () => void;
  /** Don't show the "Enroll a student" and "Enroll from a file" buttons (the page puts them in its header). */
  hideButtons?: boolean;
}

export interface EnrollmentDialogsHandle {
  setTransferEnrollment: (e: Enrollment | null) => void;
  setPromoteEnrollment: (e: Enrollment | null) => void;
}

const today = () => new Date().toISOString().split('T')[0];

export default React.forwardRef<EnrollmentDialogsHandle, Props>(function EnrollmentDialogs(
  {
    showCreateDialog,
    setShowCreateDialog,
    showBulkDialog,
    setShowBulkDialog,
    editingEnrollment,
    setEditingEnrollment,
    students,
    academicYears,
    grades,
    sections,
    currentAcademicYear,
    onSuccess,
    hideButtons,
  },
  ref
) {
  const [transferEnrollment, setTransferEnrollment] = React.useState<Enrollment | null>(null);
  const [promoteEnrollment, setPromoteEnrollment] = React.useState<Enrollment | null>(null);
  const [transferDate, setTransferDate] = React.useState<string>(today());
  const [transferReason, setTransferReason] = React.useState('');
  const [transferSchool, setTransferSchool] = React.useState('');
  const [promoteToGradeId, setPromoteToGradeId] = React.useState('');
  const promote = usePromoteEnrollment();
  const transfer = useTransferEnrollment();

  React.useImperativeHandle(ref, () => ({ setTransferEnrollment, setPromoteEnrollment }));

  const studentName = (enrollment: Enrollment) => {
    const s = enrollment.student ?? students.find((st) => st.id === enrollment.student_id);
    if (!s) return 'this student';
    const name = studentLabel(s);
    return s.admission_number ? `${name} (${s.admission_number})` : name;
  };

  const closePromote = () => {
    setPromoteEnrollment(null);
    setPromoteToGradeId('');
  };

  const closeTransfer = () => {
    setTransferEnrollment(null);
    setTransferDate(today());
    setTransferReason('');
    setTransferSchool('');
  };

  const higherGrades = React.useMemo(() => {
    if (!promoteEnrollment) return [];
    const currentLevel = grades.find((g) => g.id === promoteEnrollment.grade_id)?.level ?? -Infinity;
    return grades.filter((g) => g.level > currentLevel);
  }, [grades, promoteEnrollment]);

  const runPromote = async () => {
    if (!promoteEnrollment || !promoteToGradeId || !currentAcademicYear?.name) return;
    const from = grades.find((g) => g.id === promoteEnrollment.grade_id);
    const to = grades.find((g) => g.id === promoteToGradeId);
    if ((to?.level ?? -Infinity) <= (from?.level ?? -Infinity)) {
      notify.error('Choose a grade higher than the current one.');
      return;
    }
    try {
      const result = await promote.mutateAsync({ id: promoteEnrollment.id, targetYearName: currentAcademicYear.name });
      const problem = result?.errors?.[0]?.error;
      if (problem) {
        notify.error(`The student wasn't promoted: ${problem}`);
        return;
      }
      notify.success(`${studentName(promoteEnrollment)} is promoted.`);
      closePromote();
      onSuccess();
    } catch (error) {
      notify.error(errorMessage(error, "The student wasn't promoted. Try again."));
    }
  };

  const runTransfer = async () => {
    if (!transferEnrollment) return;
    try {
      await transfer.mutateAsync({
        id: transferEnrollment.id,
        date: transferDate,
        reason: transferReason || undefined,
        school: transferSchool || undefined,
      });
      notify.success(`${studentName(transferEnrollment)} is marked transferred.`);
      closeTransfer();
      onSuccess();
    } catch (error) {
      notify.error(errorMessage(error, "The transfer wasn't saved. Try again."));
    }
  };

  return (
    <>
      {!hideButtons ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setShowBulkDialog(true)}>
            Enroll from a file
          </Button>
          <Button className="min-h-11 md:min-h-9" onClick={() => setShowCreateDialog(true)}>
            Enroll a student
          </Button>
        </div>
      ) : null}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle>Enroll a student</DialogTitle>
            <DialogDescription>Choose a student, or add a new one, and the class they join.</DialogDescription>
          </DialogHeader>
          {showCreateDialog ? (
            <EnrollmentForm
              students={students}
              academicYears={academicYears}
              grades={grades}
              currentAcademicYear={currentAcademicYear}
              onCancel={() => setShowCreateDialog(false)}
              onSuccess={() => {
                setShowCreateDialog(false);
                onSuccess();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingEnrollment)} onOpenChange={(open) => !open && setEditingEnrollment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle>Edit enrollment</DialogTitle>
            {editingEnrollment ? <DialogDescription>{studentName(editingEnrollment)}</DialogDescription> : null}
          </DialogHeader>
          {editingEnrollment ? (
            <EnrollmentForm
              key={editingEnrollment.id}
              enrollment={editingEnrollment}
              students={students}
              academicYears={academicYears}
              grades={grades}
              currentAcademicYear={currentAcademicYear}
              onCancel={() => setEditingEnrollment(null)}
              onSuccess={() => {
                setEditingEnrollment(null);
                onSuccess();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle>Enroll students from a file</DialogTitle>
            <DialogDescription>Everyone in the file joins the class you choose.</DialogDescription>
          </DialogHeader>
          {showBulkDialog ? (
            <BulkEnrollmentForm
              students={students}
              academicYears={academicYears}
              grades={grades}
              sections={sections}
              currentAcademicYear={currentAcademicYear}
              onCancel={() => setShowBulkDialog(false)}
              onSuccess={() => {
                setShowBulkDialog(false);
                onSuccess();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(promoteEnrollment)} onOpenChange={(open) => !open && closePromote()}>
        <DialogContent>
          <DialogHeader className="mb-4">
            <DialogTitle>Promote {promoteEnrollment ? studentName(promoteEnrollment) : ''}?</DialogTitle>
            <DialogDescription>
              {currentAcademicYear?.name
                ? `The student moves up a grade in ${currentAcademicYear.name}.`
                : 'There is no current school year. Set one before promoting students.'}
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="Promote to"
            required
            description={higherGrades.length === 0 ? 'There is no higher grade.' : undefined}
          >
            <select
              className={selectClass}
              value={promoteToGradeId}
              onChange={(e) => setPromoteToGradeId(e.target.value)}
              disabled={higherGrades.length === 0}
            >
              <option value="">Choose a higher grade</option>
              {higherGrades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </FormField>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={closePromote} disabled={promote.isPending}>
              Cancel
            </Button>
            <Button
              className="min-h-11 md:min-h-9"
              onClick={runPromote}
              disabled={!promoteToGradeId || !currentAcademicYear?.name || promote.isPending}
            >
              {promote.isPending ? 'Promoting…' : 'Promote student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(transferEnrollment)} onOpenChange={(open) => !open && closeTransfer()}>
        <DialogContent>
          <DialogHeader className="mb-4">
            <DialogTitle>Transfer {transferEnrollment ? studentName(transferEnrollment) : ''} out?</DialogTitle>
            <DialogDescription>
              The enrollment is marked Transferred from {transferDate ? formatDate(transferDate) : 'the date you choose'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Transfer date" required>
              <Input
                type="date"
                className="h-11 text-base md:h-9 md:text-sm"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </FormField>
            <FormField label="Reason">
              <Input
                className="h-11 text-base md:h-9 md:text-sm"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="For example: family moved"
              />
            </FormField>
            <FormField label="New school">
              <Input
                className="h-11 text-base md:h-9 md:text-sm"
                value={transferSchool}
                onChange={(e) => setTransferSchool(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={closeTransfer} disabled={transfer.isPending}>
              Cancel
            </Button>
            <Button className="min-h-11 md:min-h-9" onClick={runTransfer} disabled={!transferDate || transfer.isPending}>
              {transfer.isPending ? 'Saving…' : 'Transfer student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
