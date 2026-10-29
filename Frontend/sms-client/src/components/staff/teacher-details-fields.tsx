"use client"

// The teacher details form fields, shared by "Add a teacher" and "Edit details".
// One zod schema; empty optional fields are left out (add) or cleared (edit) by the helpers below.

import * as React from "react"
import { z } from "zod"
import type { FieldErrors, UseFormRegister } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import type { StaffCreate, StaffMember, StaffUpdate } from "@/services/api/staff-service"

const USERNAME_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} can be at most ${max} characters`)

export const teacherDetailsSchema = z.object({
  first_name: z.string().trim().min(1, "Enter the first name").max(100, "First name can be at most 100 characters"),
  last_name: z.string().trim().min(1, "Enter the last name").max(100, "Last name can be at most 100 characters"),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter an email like name@example.com, or leave it empty"),
  username: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 3 && v.length <= 50), "Use 3 to 50 characters, or leave it empty")
    .refine(
      (v) => v === "" || USERNAME_PATTERN.test(v.toLowerCase()),
      "Use lowercase letters and digits, with . _ or - between them (like ama.kollie)"
    ),
  employee_id: optionalText(50, "Employee ID"),
  phone_number: optionalText(30, "Phone number"),
  gender: z.string(),
  department: optionalText(100, "Department"),
  qualification: optionalText(200, "Qualification"),
  joining_date: z.string(),
  address: optionalText(300, "Address"),
})

export type TeacherDetailsValues = z.infer<typeof teacherDetailsSchema>

export const emptyTeacherDetails: TeacherDetailsValues = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  employee_id: "",
  phone_number: "",
  gender: "",
  department: "",
  qualification: "",
  joining_date: "",
  address: "",
}

export function detailsFromTeacher(t: StaffMember): TeacherDetailsValues {
  return {
    first_name: t.first_name ?? "",
    last_name: t.last_name ?? "",
    email: t.email ?? "",
    username: t.username ?? "",
    employee_id: t.employee_id ?? "",
    phone_number: t.phone_number ?? "",
    gender: t.gender ?? "",
    department: t.department ?? "",
    qualification: t.qualification ?? "",
    joining_date: t.joining_date ? t.joining_date.slice(0, 10) : "",
    address: t.address ?? "",
  }
}

/** Create payload: empty optional fields are left out (the school generates username, employee ID, password). */
export function toCreatePayload(v: TeacherDetailsValues): StaffCreate {
  const payload: StaffCreate = { first_name: v.first_name.trim(), last_name: v.last_name.trim() }
  const optional = ["email", "username", "employee_id", "phone_number", "gender", "department", "qualification", "joining_date", "address"] as const
  for (const key of optional) {
    const value = v[key].trim()
    if (value) payload[key] = key === "username" ? value.toLowerCase() : value
  }
  return payload
}

/** Update payload: emptied optional fields are cleared; username and employee ID are kept when emptied. */
export function toUpdatePayload(v: TeacherDetailsValues): StaffUpdate {
  const blankToNull = (s: string) => (s.trim() ? s.trim() : null)
  const payload: StaffUpdate = {
    first_name: v.first_name.trim(),
    last_name: v.last_name.trim(),
    email: blankToNull(v.email),
    phone_number: blankToNull(v.phone_number),
    gender: blankToNull(v.gender),
    department: blankToNull(v.department),
    qualification: blankToNull(v.qualification),
    joining_date: blankToNull(v.joining_date),
    address: blankToNull(v.address),
  }
  if (v.username.trim()) payload.username = v.username.trim().toLowerCase()
  if (v.employee_id.trim()) payload.employee_id = v.employee_id.trim()
  return payload
}

const inputClass = "h-11 md:h-10"

export interface TeacherDetailsFieldsProps {
  register: UseFormRegister<TeacherDetailsValues>
  errors: FieldErrors<TeacherDetailsValues>
  departments?: string[]
  mode: "create" | "edit"
}

function TeacherDetailsFields({ register, errors, departments = [], mode }: TeacherDetailsFieldsProps) {
  const departmentListId = React.useId()
  const isCreate = mode === "create"

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground sm:col-span-2">Name and sign-in</legend>
        <FormField label="First name" required error={errors.first_name?.message}>
          <Input autoComplete="off" className={inputClass} {...register("first_name")} />
        </FormField>
        <FormField label="Last name" required error={errors.last_name?.message}>
          <Input autoComplete="off" className={inputClass} {...register("last_name")} />
        </FormField>
        <FormField
          label="Email"
          error={errors.email?.message}
          description={isCreate ? "Optional. They can sign in with their username instead." : "Optional. Leave empty if they have none."}
        >
          <Input type="email" inputMode="email" autoComplete="off" className={inputClass} {...register("email")} />
        </FormField>
        <FormField
          label="Username"
          error={errors.username?.message}
          description={
            isCreate
              ? "Optional. Leave empty and we'll make one from the name, like ama.kollie."
              : "They sign in with this or their email."
          }
        >
          <Input
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={inputClass}
            {...register("username")}
          />
        </FormField>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground sm:col-span-2">Work</legend>
        <FormField
          label="Employee ID"
          error={errors.employee_id?.message}
          description={isCreate ? "Optional. Leave empty to number it automatically." : undefined}
        >
          <Input autoComplete="off" className={inputClass} {...register("employee_id")} />
        </FormField>
        <FormField label="Department" error={errors.department?.message} description="Pick one or type a new one.">
          <Input autoComplete="off" list={departmentListId} className={inputClass} {...register("department")} />
        </FormField>
        <datalist id={departmentListId}>
          {departments.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <FormField label="Qualification" error={errors.qualification?.message}>
          <Input autoComplete="off" placeholder="e.g. B.Ed. Mathematics" className={inputClass} {...register("qualification")} />
        </FormField>
        <FormField label="Joining date" error={errors.joining_date?.message}>
          <Input type="date" className={inputClass} {...register("joining_date")} />
        </FormField>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground sm:col-span-2">Contact</legend>
        <FormField label="Phone number" error={errors.phone_number?.message}>
          <Input type="tel" inputMode="tel" autoComplete="off" className={inputClass} {...register("phone_number")} />
        </FormField>
        <FormField label="Gender" error={errors.gender?.message}>
          <select
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-10 md:text-sm"
            {...register("gender")}
          >
            <option value="">Not given</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </FormField>
        <FormField label="Address" error={errors.address?.message} className="sm:col-span-2">
          <Input autoComplete="off" className={inputClass} {...register("address")} />
        </FormField>
      </fieldset>
    </div>
  )
}

export { TeacherDetailsFields }
