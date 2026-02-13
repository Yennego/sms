import { AttendanceBase, AttendanceStatus } from './attendance';

export interface EnhancedAttendanceFilters {
  // Existing filters
  student_id?: string;
  class_id?: string;
  schedule_id?: string;
  academic_year_id?: string;
  start_date?: string;
  end_date?: string;
  status?: AttendanceStatus;
  date?: string;
  
  // Enhanced class-based filters
  grade_id?: string;
  section_id?: string;
  subject_id?: string;
  teacher_id?: string;
  
  // Additional filters
  attendance_percentage_min?: number;
  attendance_percentage_max?: number;
  has_comments?: boolean;
  marked_by?: string;
}

export interface AttendanceWithClassContext extends AttendanceBase {
  id: string;
  tenant_id: string;
  marked_by: string;
  marked_at: string;
  created_at: string;
  updated_at: string;
  
  // Class context
  class_name: string;
  grade_id: string;
  grade_name: string;
  section_id: string;
  section_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  
  // Student context
  student_name: string;
  student_admission_number: string;
  
  // Marking context
  marked_by_name: string;
}

export interface BulkAttendanceOperation {
  operation_type: 'mark' | 'update' | 'delete';
  class_id: string;
  date: string;
  records: {
    student_id: string;
    status: AttendanceStatus;
    check_in_time?: string;
    check_out_time?: string;
    comments?: string;
  }[];
}

export interface AttendanceInsights {
  trends: {
    period: string;
    attendance_rate: number;
    improvement: number;
  }[];
  
  patterns: {
    day_of_week: string;
    average_attendance: number;
  }[];
  
  alerts: {
    type: 'low_attendance' | 'frequent_late' | 'improvement_needed';
    message: string;
    entity_type: 'student' | 'class' | 'subject';
    entity_id: string;
    entity_name: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

export interface ClassScheduleAttendance {
  schedule_id: string;
  class_id: string;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  time_slot: string;
  day_of_week: string;
  room: string;
  expected_students: number;
  marked_attendance: number;
  attendance_percentage: number;
  status: 'pending' | 'in_progress' | 'completed';
}