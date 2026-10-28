// First path segments that are never a school. A school's address is its slug (/{slug}/...),
// so a school can't take any of these: the backend refuses them when a school is created or its
// domain changes (src/core/constants/reserved_slugs.py — keep the two lists the same).

export const RESERVED_SLUGS: readonly string[] = [
  // Platform and framework paths
  'api', '_next', 'static', 'public', 'favicon.ico', 'assets', 'www',
  'platform', 'super-admin', 'admin-dashboard',
  // Sign-in and account pages that also exist outside a school
  'login', 'logout', 'register', 'session-expired', 'forgot-password', 'reset-password',
  'change-password', 'profile',
  // Area names (today's and the remodel's), so /{area} is never mistaken for a school
  'dashboard', 'home', 'academics', 'admin', 'students', 'student', 'teachers', 'teacher', 'staff',
  'parents', 'parent', 'classes', 'attendance', 'scan', 'grades', 'gradebook', 'results', 'exams',
  'assignments', 'timetable', 'timetables', 'finance', 'fees', 'communication', 'messages',
  'resources', 'logging', 'settings', 'users', 'schools', 'audit', 'reports',
];

const RESERVED = new Set(RESERVED_SLUGS);

/**
 * True for the platform operator's pages: /platform/... (and the old /super-admin/... address,
 * which next.config.ts redirects to /platform). These pages use the SUPER_ADMIN (sa_) cookies.
 */
export function isPlatformPath(pathname: string | null | undefined): boolean {
  const first = pathname?.split('/').filter(Boolean)[0]?.toLowerCase();
  return first === 'platform' || first === 'super-admin';
}

/** True when this first path segment can't be a school (case-insensitive). */
export function isReservedSlug(segment: string | null | undefined): boolean {
  return !!segment && RESERVED.has(segment.toLowerCase());
}
