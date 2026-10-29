"use client"

// TanStack Query hooks for the Staff area. Keys sit under the existing ['teachers', schoolKey]
// prefix so older pages that invalidate teachers also refresh these, and vice versa.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { useTenant } from "@/hooks/use-tenant"
import { teacherKeys } from "@/hooks/queries/teachers"
import { useCurrentAcademicYearDetail } from "@/hooks/queries/academic-years"
import {
  useStaffService,
  type StaffCreate,
  type StaffUpdate,
} from "@/services/api/staff-service"

export const staffKeys = {
  all: (schoolKey: string | null) => [...teacherKeys.all(schoolKey), "staff"] as const,
  list: (schoolKey: string | null) => [...staffKeys.all(schoolKey), "list"] as const,
  detail: (schoolKey: string | null, id: string) => [...staffKeys.all(schoolKey), "detail", id] as const,
  departments: (schoolKey: string | null) => [...staffKeys.all(schoolKey), "departments"] as const,
  teaching: (schoolKey: string | null, id: string, yearId: string | null) =>
    [...staffKeys.all(schoolKey), "teaching", id, yearId] as const,
  yearClasses: (schoolKey: string | null, yearId: string | null) =>
    [...staffKeys.all(schoolKey), "year-classes", yearId] as const,
  sponsored: (schoolKey: string | null, id: string) => [...staffKeys.all(schoolKey), "sponsored", id] as const,
}

export function useStaffList() {
  const service = useStaffService()
  const { tenantKey } = useTenant()
  return useQuery({
    queryKey: staffKeys.list(tenantKey),
    queryFn: () => service.listTeachers(),
    enabled: !!tenantKey,
  })
}

export function useStaffMember(id: string) {
  const service = useStaffService()
  const { tenantKey } = useTenant()
  return useQuery({
    queryKey: staffKeys.detail(tenantKey, id),
    queryFn: () => service.getTeacher(id),
    enabled: !!tenantKey && !!id,
    retry: (count, error) => (error as { statusCode?: number })?.statusCode !== 404 && count < 2,
  })
}

export function useStaffDepartments() {
  const service = useStaffService()
  const { tenantKey } = useTenant()
  return useQuery({
    queryKey: staffKeys.departments(tenantKey),
    queryFn: () => service.getDepartments(),
    enabled: !!tenantKey,
    staleTime: 5 * 60 * 1000,
  })
}

/** The current school year, or null when none is set (queries then cover all years). */
export function useCurrentYear() {
  const query = useCurrentAcademicYearDetail()
  return {
    year: query.data ?? null,
    settled: query.isSuccess || query.isError,
  }
}

/** Classes of the current year, used to show "sponsor of" in the directory. */
export function useYearClasses() {
  const service = useStaffService()
  const { tenantKey } = useTenant()
  const { year, settled } = useCurrentYear()
  const yearId = year?.id ?? null
  return useQuery({
    queryKey: staffKeys.yearClasses(tenantKey, yearId),
    queryFn: () => service.getClasses({ academicYearId: yearId ?? undefined }),
    enabled: !!tenantKey && settled,
    staleTime: 60 * 1000,
  })
}

export function useTeachingAssignments(teacherId: string, yearId: string | null, enabled = true) {
  const service = useStaffService()
  const { tenantKey } = useTenant()
  return useQuery({
    queryKey: staffKeys.teaching(tenantKey, teacherId, yearId),
    queryFn: () => service.getTeachingAssignments(teacherId, yearId ?? undefined),
    enabled: !!tenantKey && !!teacherId && enabled,
  })
}

/** Every class (any year) whose sponsor is this teacher. */
export function useSponsoredClasses(teacherId: string) {
  const service = useStaffService()
  const { tenantKey } = useTenant()
  return useQuery({
    queryKey: staffKeys.sponsored(tenantKey, teacherId),
    queryFn: () => service.getClasses({ sponsorId: teacherId }),
    enabled: !!tenantKey && !!teacherId,
  })
}

export function useAddTeacher() {
  const service = useStaffService()
  const queryClient = useQueryClient()
  const { tenantKey } = useTenant()
  return useMutation({
    mutationFn: (data: StaffCreate) => service.createTeacher(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teacherKeys.all(tenantKey) }),
  })
}

export function useUpdateStaffMember() {
  const service = useStaffService()
  const queryClient = useQueryClient()
  const { tenantKey } = useTenant()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StaffUpdate }) => service.updateTeacher(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teacherKeys.all(tenantKey) }),
  })
}

export function useResetStaffPassword() {
  const service = useStaffService()
  return useMutation({
    mutationFn: (userId: string) => service.resetPassword(userId),
  })
}
