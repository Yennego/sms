import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnrollmentService } from '@/services/api/enrollment-service';
import { useSectionService } from '@/services/api/section-service';
import { Student } from '@/types/student';
import { Section } from '@/types/section';
import { AcademicYear, Grade } from '@/types/enrollment';
import { ErrorType } from '@/utils/error-utils';
import { UserPlus, X } from 'lucide-react';

interface StudentAssignmentDialogProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StudentAssignmentDialog({
  student,
  isOpen,
  onClose,
  onSuccess
}: StudentAssignmentDialogProps) {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friendlyErrorMessage = (err: unknown): string => {
    // Map common server statuses to human-friendly copy
    if (err && typeof err === 'object') {
      const e = err as { statusCode?: number; status?: number; type?: ErrorType; message?: string };
      const status = e.statusCode ?? e.status;

      if (status === 404) {
        return 'We couldn’t find the enrollment details for this student. Please verify the student exists and try again.';
      }
      if (status === 401) {
        return 'Your session may have expired. Please sign in again and retry.';
      }
      if (status === 403) {
        return 'You don’t have permission to assign students. Contact your administrator if this is unexpected.';
      }
      if (status === 422 || e.type === ErrorType.VALIDATION) {
        return e.message || 'Some of the provided data is invalid. Please review and try again.';
      }

      // Hide technical paths/HTML messages while preserving a helpful summary
      const raw = typeof e.message === 'string' ? e.message : '';
      if (raw.includes('/people/students') && raw.includes('/enrollments')) {
        return 'Could not load enrollment information at the moment. Please try again.';
      }
    }

    // Fallback
    return 'Something went wrong while assigning the student. Please try again.';
  };

  const enrollmentService = useEnrollmentService();
  const sectionService = useSectionService();

  const loadInitialData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [academicYearsData, gradesData] = await Promise.all([
        enrollmentService.getAcademicYears(),
        enrollmentService.getGrades()
      ]);
      setAcademicYears(academicYearsData);
      setGrades(gradesData);
      const currentYear = academicYearsData.find(year => year.is_current);
      if (currentYear) {
        setSelectedAcademicYear(currentYear.id);
      }
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [enrollmentService]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, loadInitialData]);

  const loadSections = React.useCallback(async () => {
    try {
      const sectionsData = await sectionService.getSectionsByGrade(selectedGrade);
      setSections(sectionsData);
    } catch (err) {
      console.error('Failed to load sections:', err);
      setSections([]);
    }
  }, [sectionService, selectedGrade]);

  useEffect(() => {
    if (selectedGrade) {
      loadSections();
    } else {
      setSections([]);
      setSelectedSection('');
    }
  }, [selectedGrade, loadSections]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!student || !selectedAcademicYear || !selectedGrade || !selectedSection) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check for an existing active enrollment in the selected academic year
      const existingCurrent = await enrollmentService.getCurrentEnrollment(student.id);

      if (existingCurrent && existingCurrent.status === 'active' && existingCurrent.academic_year_id === selectedAcademicYear) {
        await enrollmentService.updateEnrollment(existingCurrent.id, {
          academic_year_id: selectedAcademicYear,
          grade_id: selectedGrade,
          section_id: selectedSection,
          status: 'active',
          enrollment_date: existingCurrent.enrollment_date || new Date().toISOString().split('T')[0],
        });
      } else {
        await enrollmentService.createEnrollment({
          student_id: student.id,
          academic_year_id: selectedAcademicYear,
          grade_id: selectedGrade,
          section_id: selectedSection,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'active',
        });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAcademicYear('');
    setSelectedGrade('');
    setSelectedSection('');
    setError(null);
    onClose();
  };

  if (!student) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Student to Grade & Section
          </DialogTitle>
          <DialogDescription>
            Select academic year, grade, and section to assign this student.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">Student</p>
            <p className="font-medium">{student.firstName} {student.lastName}</p>
            <p className="text-sm text-gray-500">{student.admission_number}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="academicYear">Academic Year *</Label>
              <Select
                value={selectedAcademicYear}
                onValueChange={setSelectedAcademicYear}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name} {year.is_current && '(Current)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade">Grade *</Label>
              <Select
                value={selectedGrade}
                onValueChange={setSelectedGrade}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section">Section *</Label>
              <Select
                value={selectedSection}
                onValueChange={setSelectedSection}
                disabled={loading || !selectedGrade}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <UserPlus className="w-4 h-4 mr-2" />
                {loading ? 'Assigning...' : 'Assign Student'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
