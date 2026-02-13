export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused'
}

export interface AttendanceBase {
  student_id: string;
  class_id: string;
  schedule_id: string;
  academic_year_id: string;
  date: string; // ISO date string
  status: AttendanceStatus;
  check_in_time?: string; // ISO datetime string
  check_out_time?: string; // ISO datetime string
  comments?: string;
}

export interface AttendanceCreate extends AttendanceBase {
  marked_by: string;
}

export interface AttendanceUpdate {
  status?: AttendanceStatus;
  check_in_time?: string;
  check_out_time?: string;
  comments?: string;
}

export interface Attendance extends AttendanceBase {
  id: string;
  tenant_id: string;
  marked_by: string;
  marked_at: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceWithDetails extends Attendance {
  student_name: string;
  class_name: string;
  marked_by_name: string;
}

export interface AttendanceSummary {
  date: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  attendance_percentage: number; // Changed from attendance_rate to attendance_percentage
}

export interface BulkAttendanceCreate {
  class_id?: string;
  schedule_id?: string;
  academic_year_id: string;
  date: string; // ISO date
  period?: string;
  marked_by?: string;
  class_name?: string;
  academic_year_name?: string;
  attendances: Array<{
    student_id: string;
    status: AttendanceStatus;
  }>;
}

export interface AttendanceFilters {
  student_id?: string;
  class_id?: string;
  schedule_id?: string;
  academic_year_id?: string;
  start_date?: string;
  end_date?: string;
  status?: AttendanceStatus;
  date?: string;
}

export interface AttendanceReport {
  summary: AttendanceSummary;
  records: AttendanceWithDetails[];
  generated_at: string;
  report_type: string;
}