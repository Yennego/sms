import { useAttendanceService } from './attendance-service';
import { useClassService } from './class-service';
import { useAcademicGradeService } from './academic-grade-service';
import { 
  Attendance, 
  AttendanceFilters, 
  AttendanceSummary,
  BulkAttendanceCreate,
  AttendanceStatus 
} from '@/types/attendance';
import { Class } from '@/types/class';

export interface EnhancedAttendanceFilters extends AttendanceFilters {
  grade_id?: string;
  section_id?: string;
  subject_id?: string;
  teacher_id?: string;
}

export interface ClassAttendanceStats {
  class_id: string;
  class_name: string;
  grade_name: string;
  section_name: string;
  subject_name: string;
  teacher_name: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  attendance_percentage: number;
}

export interface AttendanceAnalytics {
  daily_stats: AttendanceSummary[];
  class_performance: ClassAttendanceStats[];
  student_trends: {
    student_id: string;
    student_name: string;
    attendance_percentage: number;
    trend: 'improving' | 'declining' | 'stable';
  }[];
  subject_performance: {
    subject_id: string;
    subject_name: string;
    average_attendance: number;
    class_count: number;
  }[];
}

export function useEnhancedAttendanceService() {
  const attendanceService = useAttendanceService();
  const classService = useClassService();
  const gradeService = useAcademicGradeService();

  return {
    // Enhanced filtering with class relationships
    getAttendanceWithClassDetails: async (filters: EnhancedAttendanceFilters): Promise<Attendance[]> => {
      try {
        // First get classes based on academic filters
        const classFilters: Record<string, string> = {};
        if (filters.grade_id) classFilters.grade_id = filters.grade_id;
        if (filters.section_id) classFilters.section_id = filters.section_id;
        if (filters.subject_id) classFilters.subject_id = filters.subject_id;
        if (filters.teacher_id) classFilters.teacher_id = filters.teacher_id;

        const classes = await classService.getClasses(classFilters);
        const classIds = classes.map(cls => cls.id);

        // Get attendance for all matching classes
        const attendancePromises = classIds.map(classId => 
          attendanceService.getAttendanceRecords({
            ...filters,
            class_id: classId
          })
        );

        const attendanceResults = await Promise.all(attendancePromises);
        return attendanceResults.flat();
      } catch (error) {
        console.error('Error fetching attendance with class details:', error);
        throw error;
      }
    },

    // Bulk operations with class context
    bulkMarkAttendanceByClass: async (
      classId: string, 
      date: string, 
      attendanceRecords: { student_id: string; status: AttendanceStatus; comments?: string }[]
    ): Promise<Attendance[]> => {
      try {
        const classDetails = await classService.getClassById(classId);
        
        const bulkData: BulkAttendanceCreate[] = attendanceRecords.map(record => ({
          student_id: record.student_id,
          class_id: classId,
          schedule_id: classDetails.schedule_id || '', // Assuming schedule_id is available
          academic_year_id: classDetails.academic_year_id || '',
          date,
          status: record.status,
          comments: record.comments,
          marked_by: '' // Will be set by backend from auth context
        }));

        return await attendanceService.bulkMarkAttendance(bulkData);
      } catch (error) {
        console.error('Error bulk marking attendance by class:', error);
        throw error;
      }
    },

    // Analytics and insights
    getAttendanceAnalytics: async (filters: {
      start_date?: string;
      end_date?: string;
      grade_id?: string;
      section_id?: string;
    }): Promise<AttendanceAnalytics> => {
      try {
        // Get classes based on filters
        const classes = await classService.getClasses({
          grade_id: filters.grade_id,
          section_id: filters.section_id
        });

        // Get attendance data for each class
        const analyticsPromises = classes.map(async (cls) => {
          const summary = await attendanceService.getAttendanceSummary({
            class_id: cls.id,
            start_date: filters.start_date,
            end_date: filters.end_date
          });

          return {
            class_id: cls.id,
            class_name: cls.name || `${cls.grade_name} - ${cls.section_name} - ${cls.subject_name}`,
            grade_name: cls.grade_name,
            section_name: cls.section_name,
            subject_name: cls.subject_name,
            teacher_name: cls.teacher_name,
            ...summary
          };
        });

        const classStats = await Promise.all(analyticsPromises);

        // Calculate subject performance
        const subjectPerformance = classes.reduce((acc, cls) => {
          const existing = acc.find(s => s.subject_id === cls.subject_id);
          const classAttendance = classStats.find(s => s.class_id === cls.id)?.attendance_percentage || 0;
          
          if (existing) {
            existing.average_attendance = (existing.average_attendance * existing.class_count + classAttendance) / (existing.class_count + 1);
            existing.class_count += 1;
          } else {
            acc.push({
              subject_id: cls.subject_id,
              subject_name: cls.subject_name,
              average_attendance: classAttendance,
              class_count: 1
            });
          }
          return acc;
        }, [] as Array<{ subject_id: string; subject_name: string; average_attendance: number; class_count: number }>);

        return {
          daily_stats: [], // Would need additional API calls for daily breakdown
          class_performance: classStats,
          student_trends: [], // Would need additional API calls for student trends
          subject_performance: subjectPerformance
        };
      } catch (error) {
        console.error('Error fetching attendance analytics:', error);
        throw error;
      }
    },

    // Class-based attendance summary
    getClassAttendanceSummary: async (classId: string, dateRange: { start_date: string; end_date: string }): Promise<{
      class_details: Class;
      attendance_summary: AttendanceSummary;
      student_list: unknown[];
    }> => {
      try {
        const [classDetails, attendanceSummary, students] = await Promise.all([
          classService.getClassWithDetails(classId),
          attendanceService.getAttendanceSummary({
            class_id: classId,
            ...dateRange
          }),
          classService.getClassStudents(classId)
        ]);

        return {
          class_details: classDetails,
          attendance_summary: attendanceSummary,
          student_list: students
        };
      } catch (error) {
        console.error('Error fetching class attendance summary:', error);
        throw error;
      }
    },

    // Teacher's classes attendance overview
    getTeacherAttendanceOverview: async (teacherId: string, date?: string): Promise<ClassAttendanceStats[]> => {
      try {
        const teacherClasses = await classService.getClassesByTeacher(teacherId);
        
        const attendancePromises = teacherClasses.map(async (cls) => {
          const summary = await attendanceService.getAttendanceSummary({
            class_id: cls.id,
            start_date: date,
            end_date: date
          });

          return {
            class_id: cls.id,
            class_name: cls.name || `${cls.grade_name} - ${cls.section_name} - ${cls.subject_name}`,
            grade_name: cls.grade_name,
            section_name: cls.section_name,
            subject_name: cls.subject_name,
            teacher_name: cls.teacher_name,
            ...summary
          };
        });

        return await Promise.all(attendancePromises);
      } catch (error) {
        console.error('Error fetching teacher attendance overview:', error);
        throw error;
      }
    },

    // Grade-wise attendance comparison
    getGradeAttendanceComparison: async (): Promise<{
      grade_id: string;
      grade_name: string;
      total_classes: number;
      average_attendance: number;
      best_performing_class: string;
      worst_performing_class: string;
    }[]> => {
      try {
        const grades = await gradeService.getActiveGrades();
        
        const gradeStatsPromises = grades.map(async (grade) => {
          const gradeClasses = await classService.getClassesByGrade(grade.id);
          
          const classAttendancePromises = gradeClasses.map(cls => 
            attendanceService.getAttendanceSummary({ class_id: cls.id })
          );
          
          const classAttendanceData = await Promise.all(classAttendancePromises);
          
          const averageAttendance = classAttendanceData.reduce((sum, data) => 
            sum + data.attendance_percentage, 0) / classAttendanceData.length;
          
          const bestClass = classAttendanceData.reduce((best, current, index) => 
            current.attendance_percentage > best.percentage ? 
              { percentage: current.attendance_percentage, index } : best, 
            { percentage: 0, index: 0 }
          );
          
          const worstClass = classAttendanceData.reduce((worst, current, index) => 
            current.attendance_percentage < worst.percentage ? 
              { percentage: current.attendance_percentage, index } : worst, 
            { percentage: 100, index: 0 }
          );

          return {
            grade_id: grade.id,
            grade_name: grade.name,
            total_classes: gradeClasses.length,
            average_attendance: averageAttendance,
            best_performing_class: gradeClasses[bestClass.index]?.name || '',
            worst_performing_class: gradeClasses[worstClass.index]?.name || ''
          };
        });

        return await Promise.all(gradeStatsPromises);
      } catch (error) {
        console.error('Error fetching grade attendance comparison:', error);
        throw error;
      }
    }
  };
}
