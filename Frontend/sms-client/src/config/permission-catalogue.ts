// Plain-language names for roles and permissions, and the area each permission belongs to, for the
// role screens. The server checks the permission names; these labels are only what people read.
// A permission missing here still shows, under "Other", with a name made from its key.

export interface PermissionGroup {
  key: string;
  label: string;
}

/** In the order the role screens list them */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { key: 'students', label: 'Students and admissions' },
  { key: 'classes', label: 'Classes and the school year' },
  { key: 'staff', label: 'Staff and accounts' },
  { key: 'grades', label: 'Grades and report cards' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'homework', label: 'Homework' },
  { key: 'fees', label: 'Fees' },
  { key: 'messages', label: 'Messages' },
  { key: 'settings', label: 'School settings and dashboards' },
  { key: 'own', label: "People's own pages (teachers, students, parents)" },
  { key: 'platform', label: 'Platform (operator only)' },
  { key: 'other', label: 'Other' },
];

const P = (label: string, group: string) => ({ label, group });

export const PERMISSIONS: Record<string, { label: string; group: string }> = {
  // Students and admissions
  view_students: P('See students', 'students'),
  view_student_records: P('See student records', 'students'),
  manage_students: P('Admit and edit students', 'students'),
  create_students: P('Add students', 'students'),
  update_students: P('Edit students', 'students'),
  delete_students: P('Delete students', 'students'),
  manage_student_records: P('Edit student records', 'students'),
  manage_enrollment: P('Enroll and place students in classes', 'students'),
  promote_students: P('Promote students', 'students'),
  manage_counseling_notes: P('Write counseling notes', 'students'),

  // Classes and the school year
  view_classes: P('See classes', 'classes'),
  manage_classes: P('Manage classes, sections and grade levels', 'classes'),
  view_subjects: P('See subjects', 'classes'),
  manage_subjects: P('Manage subjects', 'classes'),
  manage_teacher_assignments: P('Assign teachers to subjects', 'classes'),
  manage_academic_year: P('Set up the school year, promotion and graduation', 'classes'),
  view_academic_data: P('See academic records', 'classes'),
  manage_academic_data: P('Manage academic records', 'classes'),
  manage_classroom_data: P('Manage their own classroom', 'classes'),

  // Staff and accounts
  view_teachers: P('See teachers', 'staff'),
  manage_teachers: P('Manage teachers', 'staff'),
  create_teachers: P('Add teachers', 'staff'),
  update_teachers: P('Edit teachers', 'staff'),
  delete_teachers: P('Delete teachers', 'staff'),
  view_users: P('See staff accounts', 'staff'),
  manage_users: P('Manage staff accounts and reset passwords', 'staff'),
  create_users: P('Create staff accounts', 'staff'),
  update_users: P('Edit staff accounts', 'staff'),
  delete_users: P('Delete staff accounts', 'staff'),
  manage_roles: P('See roles and give them to staff', 'staff'),

  // Grades and report cards
  submit_grades: P('Enter marks', 'grades'),
  publish_results: P('Review and publish results', 'grades'),
  generate_academic_reports: P('Produce academic reports', 'grades'),
  view_exam: P('See exams', 'grades'),
  create_exam: P('Create exams', 'grades'),
  update_exam: P('Edit exams', 'grades'),
  delete_exam: P('Delete exams', 'grades'),
  publish_exam: P('Publish exams', 'grades'),

  // Attendance
  mark_attendance: P('Mark attendance', 'attendance'),
  manage_attendance: P('Take attendance for their own classes', 'attendance'),
  view_attendance: P('See attendance (own classes or children)', 'attendance'),
  view_school_attendance: P("See the whole school's attendance", 'attendance'),
  manage_school_attendance: P('Run attendance for the whole school (excuses, calendar, ID cards)', 'attendance'),

  // Homework
  view_assignments: P('See assignments', 'homework'),
  create_assignments: P('Set assignments', 'homework'),
  update_assignments: P('Edit assignments', 'homework'),
  delete_assignments: P('Delete assignments', 'homework'),
  grade_assignments: P('Mark homework', 'homework'),
  submit_assignments: P('Hand in homework', 'homework'),

  // Fees
  view_financial_data: P('See fees and payments', 'fees'),
  manage_financial_data: P('Fee setup and fee settings', 'fees'),
  create_invoices: P('Issue invoices', 'fees'),
  record_payments: P('Record payments', 'fees'),
  approve_financial_transactions: P('Approve voids, adjustments and report-card holds', 'fees'),
  issue_refunds: P('Issue refunds', 'fees'),
  generate_financial_reports: P('Produce financial reports', 'fees'),
  view_budget_reports: P('See budget reports', 'fees'),
  manage_budgets: P('Manage budgets', 'fees'),
  view_payment_history: P('See payment history', 'fees'),
  view_child_financial_data: P("Parents: see their children's fees", 'fees'),
  view_own_financial_data: P('Students: see their own fees', 'fees'),

  // Messages
  send_announcements: P('Send announcements', 'messages'),
  send_notifications: P('Send messages', 'messages'),
  send_notification: P('Send notifications', 'messages'),
  view_notifications: P('See messages', 'messages'),
  view_notification: P('See notifications', 'messages'),

  // School settings and dashboards
  manage_tenant_settings: P('School settings and school profile', 'settings'),
  view_tenant_data: P("See the school's details", 'settings'),
  view_admin_dashboard: P('See the admin dashboard', 'settings'),
  view_dashboard: P('See the dashboard', 'settings'),
  view_audit_logs: P("See the school's audit log", 'settings'),

  // People's own pages
  view_teacher_dashboard: P('Teachers: their dashboard', 'own'),
  view_student_dashboard: P('Students: their dashboard', 'own'),
  view_own_records: P('Students: their own records', 'own'),
  view_own_schedule: P('Their own timetable', 'own'),
  view_child_records: P("Parents: their children's records", 'own'),

  // Platform (operator only)
  manage_tenants: P('Manage schools', 'platform'),
  manage_permissions: P('Edit the list of permissions', 'platform'),
  view_all_users: P('See users in every school', 'platform'),
  view_all_audit_logs: P('See the audit log of every school', 'platform'),
  view_all_exams: P('See exams in every school', 'platform'),
  view_all_notifications: P('See notifications in every school', 'platform'),
  view_system_reports: P('See system reports', 'platform'),
  generate_activity_reports: P('Produce activity reports across schools', 'platform'),

  // Planned modules (not built yet)
  manage_cafeteria: P('Manage the cafeteria (planned, not built yet)', 'other'),
};

const ROLES: Record<string, string> = {
  'super-admin': 'Platform operator',
  admin: 'School admin',
  'tenant-admin': 'School admin (older role)',
  'academic-admin': 'Principal',
  registrar: 'Registrar',
  accountant: 'Accountant (bursar)',
  'financial-admin': 'Finance manager',
  counselor: 'Counselor',
  'attendance-scanner': 'Gate scanner',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

/** "view_school_attendance" -> "View school attendance" for anything not in the list */
const fromKey = (key: string) => {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
};

export function permissionLabel(name: string): string {
  return PERMISSIONS[name]?.label ?? fromKey(name);
}

export function roleLabel(name: string): string {
  return ROLES[name] ?? fromKey(name);
}

/** Permissions in the role screens' order: by group, then as listed in each group */
export function groupPermissions<T extends { name: string }>(permissions: T[]): { group: PermissionGroup; items: T[] }[] {
  const order = Object.keys(PERMISSIONS);
  const rank = (name: string) => {
    const i = order.indexOf(name);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return PERMISSION_GROUPS.map((group) => ({
    group,
    items: permissions
      .filter((p) => (PERMISSIONS[p.name]?.group ?? 'other') === group.key)
      .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}
