// The switchable school areas (the school's ceiling), set per school by the platform operator.
// The server is the source of truth (GET /tenants/self/areas) and refuses an area that is off;
// these are the defaults for a school whose settings don't mention a switch yet.

export interface SchoolArea {
  key: string;
  feature: string;
  label: string;
  description: string;
  enabled: boolean;
  permissions: string[];
}

/** Switches that are on unless the operator turns them off (Fees is off until switched on). */
export const FEATURE_DEFAULTS: Record<string, boolean> = {
  enable_finance: false,
  enable_attendance: true,
  enable_homework: true,
  enable_timetable: true,
  enable_announcements: true,
};
