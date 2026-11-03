// How built-in role names read on the Users page; custom roles show their own name.

export const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
  admin: "Admin",
  "tenant-admin": "Admin",
  "academic-admin": "Academic admin (principal)",
  registrar: "Registrar",
  accountant: "Accountant",
  "financial-admin": "Financial admin",
  counselor: "Counselor",
  "attendance-scanner": "Gate scanner",
}

export function roleLabel(name: string): string {
  return ROLE_LABEL[name] ?? name
}
