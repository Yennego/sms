'use client';

// Enroll many students at once from a CSV file: rows are matched to students by id, admission
// number, email or name; rows with a name and email that match nobody become new students.

import React, { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { selectClass } from '@/components/students/admission-form';
import { errorMessage } from '@/components/students/format';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { plural } from '@/components/year-end/format';
import { useBulkCreateEnrollments, useCreateStudentsBulk, useSectionsOfGrade } from '@/components/year-end/queries';
import { AcademicYear, Grade, Section, BulkEnrollmentCreate } from '@/types/enrollment';
import { Student, StudentCreate } from '@/types/student';

interface BulkEnrollmentFormProps {
  students: Student[];
  academicYears: AcademicYear[];
  grades: Grade[];
  sections: Section[];
  currentAcademicYear: AcademicYear | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

type BulkResponseItem = { student_id?: string; id?: string; error?: string; message?: string };

export default function BulkEnrollmentForm({
  students,
  academicYears,
  grades,
  sections,
  currentAcademicYear,
  onSuccess,
  onCancel,
}: BulkEnrollmentFormProps) {
  const createStudentsBulkMutation = useCreateStudentsBulk();
  const bulkCreateEnrollmentsMutation = useBulkCreateEnrollments();

  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Define row detail type and fix state typings
  type CsvRowDetail = {
    resolvedId?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    year_name?: string;
    grade_name?: string;
    section_name?: string;
    date_text?: string;
  };

  const [csvRowsDetail, setCsvRowsDetail] = useState<CsvRowDetail[]>([]);

  const creatableCount = React.useMemo(
    () =>
      csvRowsDetail.filter(
        (r: CsvRowDetail) => !r.resolvedId && r.first_name && r.last_name && r.email
      ).length,
    [csvRowsDetail]
  );

  const normalizeDate = (d?: string) => {
    if (!d) return '';
    const t = d.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
      const [dd, mm, yyyy] = t.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
    return t;
  };

  const [formData, setFormData] = useState({
    student_ids: [] as string[],
    academic_year_id: '',
    grade_id: '',
    section_id: '',
    semester: 1,
    enrollment_date: new Date().toISOString().split('T')[0],
  });

  const [importSummary, setImportSummary] = useState<{ matched: number; notMatched: string[] }>({ matched: 0, notMatched: [] });

  useEffect(() => {
    if (currentAcademicYear?.id) {
      setFormData((prev) => (prev.academic_year_id ? prev : { ...prev, academic_year_id: currentAcademicYear.id }));
    }
  }, [currentAcademicYear?.id]);

  // Section filtering
  const { data: filteredSectionsData, isLoading: loadingSections } = useSectionsOfGrade(formData.grade_id);
  const filteredSections = React.useMemo(() => {
    return Array.isArray(filteredSectionsData) ? filteredSectionsData : [];
  }, [filteredSectionsData]);

  // Reset section on grade change moved to manual handler to prevent CSV auto-fill wipe-out

  const norm = (s: string) => s?.toString().trim().toLowerCase();
  const digits = (s: string) => {
    const m = s.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };

  const resolveAcademicYearId = (value?: string): string | undefined => {
    if (!value) return undefined;
    const v = norm(value).replace('-', '/');
    const hit = academicYears.find((y) => norm(y.name).replace('-', '/') === v);
    return hit?.id;
  };

  const resolveGradeId = (value?: string): string | undefined => {
    if (!value) return undefined;
    const v = norm(value);
    const n = digits(v);
    if (n != null) {
      const byLevel = grades.find((g) => (g?.level ?? null) === n);
      if (byLevel) return byLevel.id;
      const byNameNum = grades.find((g) => norm(g.name).includes(String(n)));
      if (byNameNum) return byNameNum.id;
    }
    const cleaned = v.replace(/^grade\s+/, '').replace(/^g\s+/, '').trim();
    const byExact = grades.find((g) => norm(g.name) === v);
    if (byExact) return byExact.id;
    const byClean = grades.find((g) => norm(g.name) === cleaned || norm(g.name).includes(cleaned));
    return byClean?.id;
  };

  const resolveSectionId = (value?: string): string | undefined => {
    if (!value) return undefined;
    const v = norm(value);
    const cleaned = v.replace(/^section\s+/, '').replace(/^sec\s+/, '').replace(/^s\s+/, '').trim();

    // First try exact match
    const byExact = sections.find((s) => norm(s.name) === v || norm(s.name) === cleaned);
    if (byExact) return byExact.id;

    // Then try partial match
    const byCleanTail = sections.find((s) => norm(s.name).endsWith(cleaned) || cleaned.endsWith(norm(s.name)));
    if (byCleanTail) return byCleanTail.id;

    const byCleanIncl = sections.find((s) => norm(s.name).includes(cleaned) || cleaned.includes(norm(s.name)));
    return byCleanIncl?.id;
  };

  const buildAdmissionToIdMap = () => {
    const m = new Map<string, string>();
    students.forEach((s) => {
      if (s.admission_number) m.set(String(s.admission_number).trim(), s.id);
    });
    return m;
  };

  // NEW: email and name indexes for matching
  const buildEmailToIdMap = () => {
    const m = new Map<string, string>();
    students.forEach((s) => {
      if (s.email) m.set(norm(s.email), s.id);
    });
    return m;
  };

  const buildNameIndex = () => {
    const index = new Map<string, string[]>();
    students.forEach((s) => {
      const key = norm(`${s.firstName} ${s.lastName}`);
      if (!key) return;
      index.set(key, [...(index.get(key) || []), s.id]);
    });
    const unique = new Map<string, string>();
    const ambiguous = new Set<string>();
    index.forEach((ids, key) => {
      if (ids.length === 1) unique.set(key, ids[0]);
      else ambiguous.add(key);
    });
    return { unique, ambiguous };
  };

  // Fix: keep this pure; do NOT use hooks here.
  const parseSimpleCsv = (
    text: string
  ): {
    importedIds: string[];
    notMatchedAdmissions: string[];
    csvIdFields: Partial<Pick<BulkEnrollmentCreate, 'academic_year_id' | 'grade_id' | 'section_id' | 'enrollment_date'>>;
    multiWarnings: string[];
    nameWarnings: string[];
    rowsDetail: CsvRowDetail[];
  } => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      return { importedIds: [], notMatchedAdmissions: [], csvIdFields: {}, multiWarnings: [], nameWarnings: [], rowsDetail: [] };
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const first = (aliases: string[]) => header.findIndex((h) => aliases.includes(h));

    // Student identity columns (now more flexible)
    const idxAdmission = first(['admission', 'admission_number', 'admission_no', 'adm_no', 'admission number', 'admission number']);
    const idxStudentId = first(['student_id', 'id', 'student id', 'studentid', 'student_uuid', 'uuid']);
    const idxFirstName = first(['first_name', 'firstname', 'first', 'fname', 'first name']);
    const idxLastName = first(['last_name', 'lastname', 'last', 'lname', 'last name']);
    const idxEmail = first(['email', 'student_email', 'e-mail']);
    const idxFullName = first(['name', 'full_name', 'fullname', 'student_name', 'student name']);

    // Per-row names for enrollment meta
    const idxYearName = first(['academic_year', 'year', 'academic_year_name', 'academic year']);
    const idxGradeName = first(['grade', 'class', 'grade_name', 'level']);
    const idxSectionName = first(['section', 'section_name', 'class_section', 'sec']);
    const idxDate = first(['enrollment_date', 'date', 'enrolled_at', 'enrollment date']);

    const admissionToId = buildAdmissionToIdMap();
    const emailToId = buildEmailToIdMap();
    const { unique: nameToId, ambiguous: ambiguousNameKeys } = buildNameIndex();

    const importedIds: string[] = [];
    const notMatchedAdmissions: string[] = [];
    const observedYearText = new Set<string>();
    const observedGradeText = new Set<string>();
    const observedSectionText = new Set<string>();
    const observedDates = new Set<string>();

    const rowsDetail: Array<{
      resolvedId?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      year_name?: string;
      grade_name?: string;
      section_name?: string;
      date_text?: string;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

      const firstName = idxFirstName >= 0 ? cells[idxFirstName] : '';
      const lastName = idxLastName >= 0 ? cells[idxLastName] : '';
      const fullName = idxFullName >= 0 ? cells[idxFullName] : '';
      const email = idxEmail >= 0 ? cells[idxEmail] : '';
      const admission = idxAdmission >= 0 ? cells[idxAdmission] : '';

      let nameKey = '';
      if (firstName && lastName) {
        nameKey = norm(`${firstName} ${lastName}`);
      } else if (fullName) {
        nameKey = norm(fullName);
      }

      let resolvedId: string | undefined;

      // Match priority: student_id → admission → email → name
      if (idxStudentId >= 0 && cells[idxStudentId]) {
        resolvedId = cells[idxStudentId];
      } else if (admission) {
        resolvedId = admissionToId.get(String(admission).trim());
      } else if (email) {
        resolvedId = emailToId.get(norm(email));
      } else if (nameKey) {
        const id = nameToId.get(nameKey);
        if (id) resolvedId = id;
        else if (ambiguousNameKeys.has(nameKey)) {
          notMatchedAdmissions.push(`${firstName || lastName || fullName} (ambiguous)`);
        }
      }

      if (!resolvedId) {
        const label = (firstName || lastName || fullName) ? `${firstName} ${lastName} ${fullName}`.trim()
          : (email || admission || `(row ${i + 1})`);
        notMatchedAdmissions.push(label || `(row ${i + 1})`);
      } else {
        importedIds.push(resolvedId);
      }

      const yText = idxYearName >= 0 ? cells[idxYearName] : '';
      const gText = idxGradeName >= 0 ? cells[idxGradeName] : '';
      const sText = idxSectionName >= 0 ? cells[idxSectionName] : '';
      const dText = idxDate >= 0 ? cells[idxDate] : '';

      if (yText) observedYearText.add(yText);
      if (gText) observedGradeText.add(gText);
      if (sText) observedSectionText.add(sText);
      if (dText) observedDates.add(dText);

      rowsDetail.push({
        resolvedId,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        email: email || undefined,
        year_name: yText || undefined,
        grade_name: gText || undefined,
        section_name: sText || undefined,
        date_text: normalizeDate(dText || undefined) || undefined, // use top-level helper
      });
    }

    const csvIdFields: Partial<Pick<BulkEnrollmentCreate, 'academic_year_id' | 'grade_id' | 'section_id' | 'enrollment_date'>> = {};
    const multiWarnings: string[] = [];
    const nameWarnings: string[] = [];

    if (observedYearText.size === 1) {
      const only = [...observedYearText][0];
      const id = resolveAcademicYearId(only);
      if (id) csvIdFields.academic_year_id = id;
      else nameWarnings.push(`Academic year "${only}" not found.`);
    } else if (observedYearText.size > 1) {
      multiWarnings.push('CSV has multiple academic year values; using selector above.');
    }

    if (observedGradeText.size === 1) {
      const only = [...observedGradeText][0];
      const id = resolveGradeId(only);
      if (id) csvIdFields.grade_id = id;
      else nameWarnings.push(`Grade "${only}" not found.`);
    } else if (observedGradeText.size > 1) {
      multiWarnings.push('CSV has multiple grade values; using selector above.');
    }

    if (observedSectionText.size === 1) {
      const only = [...observedSectionText][0];
      const id = resolveSectionId(only);
      if (id) csvIdFields.section_id = id;
      else nameWarnings.push(`Section "${only}" not found.`);
    } else if (observedSectionText.size > 1) {
      multiWarnings.push('CSV has multiple section values; using selector above.');
    }

    if (observedDates.size === 1) {
      csvIdFields.enrollment_date = normalizeDate([...observedDates][0]);
    } else if (observedDates.size > 1) {
      multiWarnings.push('CSV has multiple enrollment_date values; using selector above.');
    }

    return { importedIds, notMatchedAdmissions, csvIdFields, multiWarnings, nameWarnings, rowsDetail };
  };

  const handleCsvFile = async (file: File | null) => {
    if (!file) {
      setSelectedStudents([]);
      setCsvRowsDetail([]);
      setImportSummary({ matched: 0, notMatched: [] });
      return;
    }
    const text = await file.text();
    const { importedIds, notMatchedAdmissions, csvIdFields, multiWarnings, nameWarnings, rowsDetail } = parseSimpleCsv(text);

    setSelectedStudents(importedIds);
    setCsvRowsDetail(rowsDetail);
    setImportSummary({ matched: importedIds.length, notMatched: notMatchedAdmissions });

    setFormData((prev) => ({
      ...prev,
      academic_year_id: csvIdFields.academic_year_id ?? prev.academic_year_id,
      grade_id: csvIdFields.grade_id ?? prev.grade_id,
      section_id: csvIdFields.section_id ?? prev.section_id,
      enrollment_date: csvIdFields.enrollment_date ?? prev.enrollment_date,
    }));

    const notices = [...multiWarnings, ...nameWarnings];
    if (notices.length) notify.info(notices.join(' '));
  };

  const downloadCsvTemplate = () => {
    // Prefer human-friendly template; still backwards-compatible with admission/student_id
    const headers = ['first_name', 'last_name', 'email', 'academic_year', 'grade', 'section', 'enrollment_date'];
    const rows = students.slice(0, 5).map((s) => [
      s.firstName || '',
      s.lastName || '',
      s.email || '',
      currentAcademicYear?.name || '',
      '',
      '',
      ''
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bulk-enrollment-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.academic_year_id || !formData.grade_id || !formData.section_id) {
      notify.error('Choose a school year, grade and section.');
      return;
    }

    try {
      const missingCandidates = csvRowsDetail.filter(
        (r: CsvRowDetail) => !r.resolvedId && r.first_name && r.last_name && r.email
      );

      const newlyCreatedIds: string[] = [];
      const creationFailures: Array<{ label: string; reason: string }> = [];

      if (missingCandidates.length > 0) {
        const studentsToCreate = missingCandidates.map((r) => ({
          firstName: r.first_name!,
          lastName: r.last_name!,
          email: r.email!,
        })) as StudentCreate[];

        const results = await createStudentsBulkMutation.mutateAsync(studentsToCreate);
        results.forEach((res, idx) => {
          if (res.success) {
            newlyCreatedIds.push(res.id);
          } else {
            const candidate = missingCandidates[idx];
            creationFailures.push({
              label: `${candidate.first_name} ${candidate.last_name}`,
              reason: res.error || 'Failed to create student',
            });
          }
        });
      }

      const allIds = [...selectedStudents, ...newlyCreatedIds];
      if (allIds.length === 0) {
        notify.error('No student in the file matched or could be added. Check the file and try again.');
        return;
      }

      if (newlyCreatedIds.length) {
        notify.info(`${plural(newlyCreatedIds.length, 'new student')} added.`);
      }
      if (creationFailures.length) {
        notify.error(`${plural(creationFailures.length, 'student')} couldn't be added`, {
          description:
            creationFailures.slice(0, 3).map((f) => f.label).join(', ') + (creationFailures.length > 3 ? '…' : ''),
        });
      }

      const resp: unknown = await bulkCreateEnrollmentsMutation.mutateAsync({
        ...formData,
        student_ids: allIds,
      });

      let created: string[] = [];
      let failed: Array<{ student_id: string; reason: string }> = [];
      const idOf = (item: BulkResponseItem) => item.student_id || item.id;
      if (Array.isArray(resp)) {
        created = (resp as BulkResponseItem[]).map(idOf).filter(Boolean) as string[];
      } else if (resp && typeof resp === 'object') {
        const r = resp as { created?: BulkResponseItem[]; failed?: BulkResponseItem[] };
        if (Array.isArray(r.created)) created = r.created.map(idOf).filter(Boolean) as string[];
        if (Array.isArray(r.failed)) {
          failed = r.failed.map((item) => ({
            student_id: idOf(item) ?? '',
            reason: item.error || item.message || 'Failed',
          }));
        }
      }

      const failedNames = failed.slice(0, 3).map(({ student_id, reason }) => {
        const s = students.find((st) => st.id === student_id);
        return `${s ? `${s.firstName} ${s.lastName}` : student_id}: ${reason}`;
      });
      notify.success(`${plural(created.length, 'student')} enrolled.`, {
        description: failed.length
          ? `${failed.length} not enrolled. ${failedNames.join('; ')}${failed.length > 3 ? '…' : ''}`
          : undefined,
      });
      onSuccess();
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      notify.error(
        status === 401 || status === 403
          ? 'Your session has ended. Sign out and sign in again.'
          : errorMessage(error, "The students weren't enrolled. Try again.")
      );
    }
  };

  const isSubmitting = createStudentsBulkMutation.isPending || bulkCreateEnrollmentsMutation.isPending;
  const total = selectedStudents.length + creatableCount;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="School year" required>
          <select
            className={selectClass}
            value={formData.academic_year_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, academic_year_id: e.target.value }))}
          >
            <option value="">Choose a school year</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.is_current ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Grade" required>
          <select
            className={selectClass}
            value={formData.grade_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, grade_id: e.target.value, section_id: '' }))}
          >
            <option value="">Choose a grade</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Section"
          required
          description={!formData.grade_id ? 'Choose a grade to see its sections.' : undefined}
        >
          <select
            className={selectClass}
            value={formData.section_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, section_id: e.target.value }))}
            disabled={!formData.grade_id || loadingSections || filteredSections.length === 0}
          >
            <option value="">{loadingSections ? 'Loading sections…' : 'Choose a section'}</option>
            {filteredSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Enrollment date" required>
          <Input
            type="date"
            className="h-11 text-base md:h-9 md:text-sm"
            value={formData.enrollment_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, enrollment_date: e.target.value }))}
          />
        </FormField>

        <FormField label="Semester" required>
          <select
            className={selectClass}
            value={String(formData.semester)}
            onChange={(e) => setFormData((prev) => ({ ...prev, semester: parseInt(e.target.value, 10) }))}
          >
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
        </FormField>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <FormField
          label="CSV file"
          description="Each row needs a student_id, admission number, email, or first and last name. Optional columns academic_year, grade, section and enrollment_date fill in the choices above when every row has the same value."
        >
          <Input
            type="file"
            accept=".csv"
            className="h-11 md:h-9"
            onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
          />
        </FormField>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={downloadCsvTemplate}>
            <Download aria-hidden="true" />
            Download a template
          </Button>
          {importSummary.matched > 0 || importSummary.notMatched.length > 0 ? (
            <Button type="button" variant="ghost" className="min-h-11 md:min-h-9" onClick={() => handleCsvFile(null)}>
              Clear the file
            </Button>
          ) : null}
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {importSummary.matched} matched
          {importSummary.notMatched.length ? ` · ${importSummary.notMatched.length} not matched` : ''}
          {creatableCount ? ` · ${creatableCount} will be added as new students` : ''}
        </p>
        {importSummary.notMatched.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Not matched to a student</p>
            <ul className="ml-5 list-disc">
              {importSummary.notMatched.slice(0, 20).map((val, idx) => (
                <li key={idx}>{val || '(empty)'}</li>
              ))}
            </ul>
            {importSummary.notMatched.length > 20 ? (
              <p className="mt-1">and {importSummary.notMatched.length - 20} more</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="min-h-11 md:min-h-9" disabled={isSubmitting || total === 0}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? 'Enrolling…' : total === 0 ? 'Enroll students' : `Enroll ${plural(total, 'student')}`}
        </Button>
      </div>
    </form>
  );
}
