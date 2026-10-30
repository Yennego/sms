// One navigation map for the school app (docs/remodel/03-app-flow.md §2–3).
//
// Each role gets a home page and at most 7 menu areas. An area is one menu item; its pages are
// shown as tabs at the top of every page in the area. The sidebar, the phone bottom bar, the area
// tabs, the post-login redirect and the change-password redirect all read from here, so they
// can't disagree. Paths are relative to the school: `/students` means `/{school}/students`.
import type { ComponentType } from 'react';
import {
  BookOpen, CalendarDays, ClipboardCheck, GraduationCap, Home, Receipt, ScanLine, School,
  Settings, Users, Award, UserCog, History, ShieldCheck,
} from 'lucide-react';

export type Icon = ComponentType<{ className?: string }>;

export interface NavTab {
  label: string;
  path: string;
  /** Hidden unless the school has this feature switched on */
  feature?: string;
  /** Other pages that belong to this tab (e.g. a record's detail page) */
  also?: string[];
}

export interface NavArea {
  key: string;
  label: string;
  icon: Icon;
  /** Pages of the area; the first one is where the menu item goes */
  tabs: NavTab[];
  feature?: string;
}

export interface RoleNavigation {
  home: string;
  areas: NavArea[];
  /** Extra items in the user menu (school settings for admins) */
  settings?: NavTab[];
  /** Full-screen tools (the gate scanner) render without menus */
  bare?: boolean;
  /** Staff who may sign report cards get "My signature" in the user menu */
  signs?: boolean;
}

const tab = (label: string, path: string, feature?: string, also?: string[]): NavTab => ({ label, path, feature, also });

// --- Areas ------------------------------------------------------------------------------------

const HOME = (path: string): NavArea => ({ key: 'home', label: 'Home', icon: Home, tabs: [tab('Home', path)] });

const STUDENTS: NavArea = {
  key: 'students', label: 'Students', icon: GraduationCap,
  tabs: [
    tab('Directory', '/students'),
    tab('Admit', '/students/new'),
    tab('Import', '/students/import'),
    tab('Enrollments', '/academics/enrollments'),
    tab('Class placement', '/academics/student-assignments'),
    tab('Promotion', '/academics/promotion'),
    tab('Graduation', '/academics/graduation'),
    tab('Remedial', '/academics/remedial'),
  ],
};

const STUDENTS_READ_ONLY: NavArea = { ...STUDENTS, tabs: [tab('Directory', '/students')] };

const STAFF: NavArea = {
  key: 'staff', label: 'Staff', icon: Users,
  tabs: [
    tab('Directory', '/teachers'),
    tab('Add teacher', '/teachers/new'),
    tab('Subject assignments', '/academics/teacher-assignments'),
  ],
};

const CLASSES: NavArea = {
  key: 'classes', label: 'Classes', icon: School,
  tabs: [
    tab('Classes', '/academics/classes'),
    tab('Class rosters', '/classes'),
    tab('Sections', '/academics/sections'),
    tab('Subjects', '/academics/subjects'),
    tab('Grade levels', '/academics/grades'),
    tab('Years and terms', '/academics/academic-years'),
    tab('Semesters', '/academics/semesters'),
    tab('Timetable', '/academics/timetables'),
    tab('Setup', '/academics/setup'),
  ],
};

const ATTENDANCE: NavArea = {
  key: 'attendance', label: 'Attendance', icon: ClipboardCheck,
  tabs: [
    tab('Today', '/attendance'),
    tab('Mark', '/attendance/daily'),
    tab('Scan', '/attendance/scan'),
    tab('Excuses', '/attendance/excuses'),
    tab('Students', '/attendance/students'),
    tab('Calendar', '/attendance/calendar'),
    tab('Reports', '/attendance/reports'),
    tab('ID cards', '/attendance/id-cards'),
  ],
};

const GRADES: NavArea = {
  key: 'grades', label: 'Grades', icon: Award,
  tabs: [
    tab('Gradebook', '/academics/gradebook'),
    tab('Review and publish', '/academics/grades/publish'),
    tab('Report cards', '/academics/report-cards'),
    tab('Assignments', '/academics/assignments'),
    tab('Grading settings', '/academics/grading-schemas'),
    tab('Remedial', '/academics/remedial'),
  ],
};

const FEES: NavArea = {
  key: 'fees', label: 'Fees', icon: Receipt, feature: 'enable_finance',
  tabs: [
    tab('Overview', '/finance'),
    tab('Student accounts', '/finance/fees', undefined, ['/finance/accounts']),
    tab('Payments', '/finance/payments'),
    tab('Fee setup', '/finance/structures'),
    tab('Reports', '/finance/reports'),
    tab('Expenses', '/finance/expenditure'),
    tab('Settings', '/finance/settings'),
  ],
};

const SCHOOL_SETTINGS: NavTab[] = [
  tab('School settings', '/settings'),
  tab('School profile', '/settings/school-profile'),
  tab('Users', '/admin/users'),
  tab('Roles', '/admin/roles'),
  tab('Role assignment', '/admin/role-assignment'),
  tab('Attendance rules', '/settings/attendance'),
  tab('Audit log', '/admin/activity-logs'),
];

// --- Roles ------------------------------------------------------------------------------------

const ADMIN: RoleNavigation = {
  home: '/admin-dashboard',
  signs: true,
  areas: [HOME('/admin-dashboard'), STUDENTS, STAFF, CLASSES, ATTENDANCE, GRADES, FEES],
  settings: SCHOOL_SETTINGS,
};

const ROLES: Record<string, RoleNavigation> = {
  admin: ADMIN,
  'tenant-admin': ADMIN,
  'academic-admin': {
    home: '/admin-dashboard',
    signs: true,
    areas: [HOME('/admin-dashboard'), STUDENTS, STAFF, CLASSES, ATTENDANCE, GRADES],
  },
  registrar: {
    home: '/admin-dashboard',
    signs: true,
    areas: [HOME('/admin-dashboard'), STUDENTS, CLASSES, ATTENDANCE],
  },
  accountant: { home: '/finance', areas: [{ ...FEES, feature: undefined }, STUDENTS_READ_ONLY] },
  'financial-admin': { home: '/finance', areas: [{ ...FEES, feature: undefined }, STUDENTS_READ_ONLY] },
  counselor: { home: '/students', areas: [STUDENTS_READ_ONLY] },
  teacher: {
    home: '/teacher/dashboard',
    signs: true,
    areas: [
      HOME('/teacher/dashboard'),
      { key: 'my-classes', label: 'My classes', icon: BookOpen, tabs: [tab('My classes', '/teacher/classes')] },
      {
        key: 'attendance', label: 'Attendance', icon: ClipboardCheck,
        tabs: [tab('My class', '/teacher/attendance'), tab('Scan', '/attendance/scan')],
      },
      {
        key: 'gradebook', label: 'Gradebook', icon: Award,
        tabs: [
          tab('Gradebook', '/academics/gradebook'),
          tab('Assignments', '/academics/assignments'),
        ],
      },
      { key: 'timetable', label: 'Timetable', icon: CalendarDays, tabs: [tab('Timetable', '/academics/timetables')] },
    ],
  },
  student: {
    home: '/student/dashboard',
    areas: [
      HOME('/student/dashboard'),
      { key: 'timetable', label: 'Timetable', icon: CalendarDays, tabs: [tab('Timetable', '/student/timetable')] },
      { key: 'courses', label: 'Courses', icon: BookOpen, tabs: [tab('My courses', '/student/courses')] },
      {
        key: 'results', label: 'Results', icon: Award,
        tabs: [tab('My results', '/student/grades')],
      },
      { key: 'attendance', label: 'Attendance', icon: ClipboardCheck, tabs: [tab('Attendance', '/student/attendance')] },
    ],
  },
  parent: {
    home: '/parent',
    areas: [
      HOME('/parent'),
      { key: 'attendance', label: 'Attendance', icon: ClipboardCheck, tabs: [tab('Attendance', '/parent/attendance')] },
      { key: 'results', label: 'Results', icon: Award, tabs: [tab('Results', '/parent/results')] },
      { key: 'fees', label: 'Fees', icon: Receipt, feature: 'enable_finance', tabs: [tab('Fees', '/parent/fees')] },
    ],
  },
  'attendance-scanner': {
    home: '/attendance/scan',
    bare: true,
    areas: [{ key: 'scan', label: 'Scan', icon: ScanLine, tabs: [tab('Scan', '/attendance/scan')] }],
  },
};

// Most capable first: a user with several roles gets the first one that matches
const ROLE_PRIORITY = [
  'admin', 'tenant-admin', 'academic-admin', 'registrar', 'financial-admin', 'accountant',
  'teacher', 'counselor', 'attendance-scanner', 'parent', 'student',
];

export const SUPER_ADMIN_ROLES = ['super-admin', 'superadmin', 'super_admin'];
export const SUPER_ADMIN_HOME = '/platform/dashboard';

/** The platform operator's menu (absolute paths; "Plans and billing" arrives with Phase 7). */
export const PLATFORM_NAVIGATION: RoleNavigation = {
  home: SUPER_ADMIN_HOME,
  areas: [
    {
      key: 'home', label: 'Home', icon: Home,
      tabs: [tab('Overview', SUPER_ADMIN_HOME), tab('Analytics', '/platform/analytics')],
    },
    { key: 'schools', label: 'Schools', icon: School, tabs: [tab('Schools', '/platform/tenants')] },
    {
      key: 'users', label: 'Users', icon: Users,
      tabs: [tab('Users', '/platform/users'), tab('Roles and permissions', '/platform/roles-permissions')],
    },
    { key: 'audit', label: 'Audit', icon: History, tabs: [tab('Security and audit', '/platform/security')] },
    {
      key: 'system', label: 'System', icon: Settings,
      tabs: [
        tab('Settings', '/platform/settings'),
        tab('Health', '/platform/health'),
        tab('Database', '/platform/database'),
        tab('API docs', '/platform/api-docs'),
      ],
    },
  ],
};

export const USER_MENU_ICONS = { profile: UserCog, settings: Settings, audit: History, roles: ShieldCheck };

interface RoleSource {
  role?: string | null;
  roles?: ({ name: string } | string)[] | null;
}

/** All role names of a user, normalised (lower case, '_' → '-'). */
export function roleNames(user: RoleSource | null | undefined): string[] {
  if (!user) return [];
  const names = [user.role, ...(user.roles ?? []).map((r) => (typeof r === 'string' ? r : r?.name))];
  return [...new Set(names.filter((n): n is string => !!n).map((n) => n.toLowerCase().replace(/_/g, '-')))];
}

export function isSuperAdmin(user: RoleSource | null | undefined): boolean {
  return roleNames(user).some((r) => SUPER_ADMIN_ROLES.includes(r));
}

/** The navigation for a user's main role (unknown roles get a home-only menu). */
export function navigationFor(user: RoleSource | null | undefined): RoleNavigation {
  const names = roleNames(user);
  const role = ROLE_PRIORITY.find((r) => names.includes(r));
  return role ? ROLES[role] : { home: '/dashboard', areas: [HOME('/dashboard')] };
}

/** Where a user lands after signing in: `/{school}{home}`, or the platform for super-admins. */
export function homePath(user: RoleSource | null | undefined, schoolSlug: string | null | undefined): string {
  if (isSuperAdmin(user)) return SUPER_ADMIN_HOME;
  if (!schoolSlug) return '/login';
  return `/${schoolSlug}${navigationFor(user).home}`;
}

/** Areas and tabs the school has switched on. */
export function visibleAreas(nav: RoleNavigation, isFeatureEnabled: (key: string) => boolean): NavArea[] {
  return nav.areas
    .filter((area) => !area.feature || isFeatureEnabled(area.feature))
    .map((area) => ({ ...area, tabs: area.tabs.filter((t) => !t.feature || isFeatureEnabled(t.feature)) }))
    .filter((area) => area.tabs.length > 0);
}

/** The school-relative part of a path: `/foundation/students/new` → `/students/new`. */
export function schoolRelativePath(pathname: string): string {
  const rest = pathname.split('/').slice(2).join('/');
  return `/${rest}`.replace(/\/+$/, '') || '/';
}

function matches(relative: string, tabPath: string): boolean {
  return relative === tabPath || relative.startsWith(`${tabPath}/`);
}

/**
 * The area and tab a page belongs to: the tab with the longest matching path wins, so
 * `/academics/grades/publish` is the Publish tab, not Grade levels.
 */
export function locate(areas: NavArea[], relative: string): { area: NavArea; tab: NavTab } | null {
  let best: { area: NavArea; tab: NavTab } | null = null;
  let bestLength = -1;
  for (const area of areas) {
    for (const t of area.tabs) {
      for (const path of [t.path, ...(t.also ?? [])]) {
        if (matches(relative, path) && (!best || path.length > bestLength)) {
          best = { area, tab: t };
          bestLength = path.length;
        }
      }
    }
  }
  return best;
}
