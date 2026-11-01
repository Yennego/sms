"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { notify } from "@/components/ui/toaster"
import type { StudentRecord, StudentRecordUpdate } from "@/services/api/student-records-service"
import { selectClass } from "./admission-form"
import { errorMessage } from "./format"
import { useUpdateStudentRecord } from "./queries"

const schema = z.object({
  first_name: z.string().trim().min(1, "Enter the first name"),
  last_name: z.string().trim().min(1, "Enter the last name"),
  gender: z.string(),
  date_of_birth: z.string(),
  admission_number: z.string().trim().min(1, "Enter the admission number"),
  admission_date: z.string(),
  username: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[a-zA-Z0-9._-]{3,50}$/.test(v), "Use 3 to 50 letters, numbers, dots, dashes or underscores"),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter an email like name@example.com, or leave it empty"),
  phone_number: z.string().trim(),
  address: z.string().trim(),
})

type FormValues = z.infer<typeof schema>

function toValues(s: StudentRecord): FormValues {
  return {
    first_name: s.first_name ?? "",
    last_name: s.last_name ?? "",
    gender: s.gender ?? "",
    date_of_birth: s.date_of_birth?.slice(0, 10) ?? "",
    admission_number: s.admission_number ?? "",
    admission_date: s.admission_date?.slice(0, 10) ?? "",
    username: s.username ?? "",
    email: s.email ?? "",
    phone_number: s.phone_number ?? "",
    address: s.address ?? "",
  }
}

const inputClass = "h-11 text-base md:h-9 md:text-sm"

export function EditStudentSheet({
  student,
  open,
  onOpenChange,
}: {
  student: StudentRecord
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const update = useUpdateStudentRecord(student.id)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toValues(student) })

  React.useEffect(() => {
    if (open) reset(toValues(student))
  }, [open, student, reset])

  const formId = React.useId()

  const onSubmit = handleSubmit(async (v) => {
    const data: StudentRecordUpdate = {
      first_name: v.first_name,
      last_name: v.last_name,
      gender: v.gender || null,
      date_of_birth: v.date_of_birth || null,
      admission_number: v.admission_number,
      admission_date: v.admission_date || null,
      email: v.email || null,
      phone_number: v.phone_number || null,
      address: v.address || null,
    }
    if (v.username) data.username = v.username
    try {
      await update.mutateAsync(data)
      notify.success("Details saved")
      onOpenChange(false)
    } catch (error) {
      notify.error(`${errorMessage(error, "The details weren't saved.")} Check the fields and try again.`)
    }
  })

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit details"
      description={`${student.first_name} ${student.last_name}`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={update.isPending || !isDirty}>
            {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save details
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField label="First name" error={errors.first_name?.message} required>
          <Input {...register("first_name")} className={inputClass} />
        </FormField>
        <FormField label="Last name" error={errors.last_name?.message} required>
          <Input {...register("last_name")} className={inputClass} />
        </FormField>
        <FormField label="Gender" error={errors.gender?.message}>
          <select {...register("gender")} className={selectClass}>
            <option value="">Not recorded</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </FormField>
        <FormField label="Date of birth" error={errors.date_of_birth?.message}>
          <Input type="date" {...register("date_of_birth")} className={inputClass} />
        </FormField>
        <FormField label="Admission number" error={errors.admission_number?.message} required>
          <Input {...register("admission_number")} className={inputClass} />
        </FormField>
        <FormField label="Admission date" error={errors.admission_date?.message}>
          <Input type="date" {...register("admission_date")} className={inputClass} />
        </FormField>
        <FormField label="Username" error={errors.username?.message}>
          <Input {...register("username")} autoCapitalize="none" className={inputClass} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} className={inputClass} />
        </FormField>
        <FormField label="Phone number" error={errors.phone_number?.message}>
          <Input type="tel" inputMode="tel" {...register("phone_number")} className={inputClass} />
        </FormField>
        <FormField label="Home address" error={errors.address?.message}>
          <Input {...register("address")} className={inputClass} />
        </FormField>
      </form>
    </Sheet>
  )
}
