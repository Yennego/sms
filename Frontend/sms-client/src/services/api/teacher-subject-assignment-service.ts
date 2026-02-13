import { useApiClientWithLoading, createWaitForApiClientReady } from './api-client';
import {
  TeacherSubjectAssignment,
  TeacherWorkload,
  ClassSubjectAssignment,
  TeacherSubjectAssignmentCreate,
  TeacherSubjectAssignmentUpdate,
  ClassSponsor
} from '@/types/teacher-subject-assignment';
import { handleError, AppError, ErrorType } from '@/utils/error-utils';

export function useTeacherSubjectAssignmentService() {
  const { apiClient, isLoading: apiLoading } = useApiClientWithLoading();
  const waitForApiClientReady = createWaitForApiClientReady(apiClient);
  const baseUrl = '/academics/teacher-subject-assignments';

  const createAssignment = async (data: TeacherSubjectAssignmentCreate): Promise<TeacherSubjectAssignment> => {
    const client = await waitForApiClientReady();
    return await client.post<TeacherSubjectAssignment>(baseUrl, data);
  };

  const getTeacherAssignments = async (teacherId: string, academicYearId?: string, skip: number = 0, limit: number = 1000): Promise<TeacherSubjectAssignment[]> => {
    const client = await waitForApiClientReady();
    const params: any = { skip, limit };
    if (academicYearId) {
      params.academic_year_id = academicYearId;
    }
    return await client.get<TeacherSubjectAssignment[]>(
      `${baseUrl}/teacher/${teacherId}`,
      { params }
    );
  };

  const getUnassignedSubjects = async (academicYearId: string): Promise<ClassSubjectAssignment[]> => {
    const client = await waitForApiClientReady();
    return await client.get<ClassSubjectAssignment[]>(
      `${baseUrl}/unassigned`,
      { params: { academic_year_id: academicYearId } }
    );
  };

  const getAllAssignments = async (academicYearId: string): Promise<ClassSubjectAssignment[]> => {
    const client = await waitForApiClientReady();
    console.log('[TeacherSubjectAssignmentService] Getting all assignments for academic year ID:', academicYearId);
    try {
      // Use query parameter instead of path
      return await client.get<ClassSubjectAssignment[]>(
        `${baseUrl}/all`,
        { params: { academic_year_id: academicYearId, skip: 0, limit: 1000 } }
      );
    } catch (error) {
      const appErr = handleError(error);
      if (appErr instanceof AppError && appErr.type === ErrorType.NOT_FOUND) {
        // No assignments yet for the academic year → return empty
        return [];
      }
      throw error;
    }
  };

  const getTeacherWorkload = async (academicYearId: string): Promise<TeacherWorkload[]> => {
    const client = await waitForApiClientReady();
    return await client.get<TeacherWorkload[]>(
      `${baseUrl}/workload`,
      { params: { academic_year_id: academicYearId } }
    );
  };

  const updateAssignment = async (id: string, data: TeacherSubjectAssignmentUpdate): Promise<TeacherSubjectAssignment> => {
    const client = await waitForApiClientReady();
    return await client.put<TeacherSubjectAssignment>(`${baseUrl}/${id}`, data);
  };

  const deleteAssignment = async (id: string): Promise<void> => {
    const client = await waitForApiClientReady();
    await client.delete(`${baseUrl}/${id}`);
  };

  const reassignTeacher = async (
    gradeId: string,
    sectionId: string,
    subjectId: string,
    academicYearId: string,
    newTeacherId: string
  ): Promise<TeacherSubjectAssignment> => {
    const client = await waitForApiClientReady();
    return await client.put<TeacherSubjectAssignment>(`${baseUrl}/reassign`, null, {
      params: {
        grade_id: gradeId,
        section_id: sectionId,
        subject_id: subjectId,
        academic_year_id: academicYearId,
        new_teacher_id: newTeacherId
      }
    });
  };

  const removeAssignment = async (
    gradeId: string,
    sectionId: string,
    subjectId: string,
    academicYearId: string
  ): Promise<void> => {
    const client = await waitForApiClientReady();
    await client.delete(`${baseUrl}/remove`, {
      params: {
        grade_id: gradeId,
        section_id: sectionId,
        subject_id: subjectId,
        academic_year_id: academicYearId
      }
    });
  };

  const getClassStudents = async (classId: string): Promise<any[]> => {
    const client = await waitForApiClientReady();
    return await client.get<any[]>(`${baseUrl}/${classId}/students`);
  };

  const bulkDeleteAssignments = async (ids: string[]): Promise<void> => {
    const client = await waitForApiClientReady();
    await client.post(`${baseUrl}/bulk-delete`, { ids });
  };

  const bulkReassignAssignments = async (
    ids: string[],
    newTeacherId: string,
    newAcademicYearId?: string
  ): Promise<void> => {
    const client = await waitForApiClientReady();
    await client.post(`${baseUrl}/bulk-reassign`, {
      ids,
      new_teacher_id: newTeacherId,
      new_academic_year_id: newAcademicYearId
    });
  };

  const getClassSponsors = async (academicYearId?: string): Promise<ClassSponsor[]> => {
    const client = await waitForApiClientReady();
    return await client.get<ClassSponsor[]>(`${baseUrl}/sponsors`, {
      params: { academic_year_id: academicYearId }
    });
  };

  const assignClassSponsor = async (sectionId: string, teacherId: string): Promise<any> => {
    const client = await waitForApiClientReady();
    return await client.put(`${baseUrl}/assign-sponsor/${sectionId}`, {
      teacher_id: teacherId
    });
  };

  return {
    createAssignment,
    getTeacherAssignments,
    getUnassignedSubjects,
    getAllAssignments,
    getTeacherWorkload,
    updateAssignment,
    deleteAssignment,
    reassignTeacher,
    removeAssignment,
    getClassStudents,
    bulkDeleteAssignments,
    bulkReassignAssignments,
    getClassSponsors,
    assignClassSponsor
  };
}
