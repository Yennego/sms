"use client"

// Edit a teacher's details in a side panel (PUT /people/teachers/{id}).

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { notify } from "@/components/ui/toaster"
import type { StaffMember } from "@/services/api/staff-service"

import { useStaffDepartments, useUpdateStaffMember } from "./use-staff"
import {
  TeacherDetailsFields,
  detailsFromTeacher,
  teacherDetailsSchema,
  toUpdatePayload,
  type TeacherDetailsValues,
} from "./teacher-details-fields"
import { errorText, fullName } from "./staff-format"

export interface EditTeacherSheetProps {
  teacher: StaffMember
  open: boolean
  onOpenChange: (open: boolean) => void
}

function EditTeacherSheet({ teacher, open, onOpenChange }: EditTeacherSheetProps) {
  const formId = React.useId()
  const departments = useStaffDepartments()
  const update = useUpdateStaffMember()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<TeacherDetailsValues>({
    resolver: zodResolver(teacherDetailsSchema),
    defaultValues: detailsFromTeacher(teacher),
  })

  // Start from the saved details each time the panel opens
  React.useEffect(() => {
    if (open) reset(detailsFromTeacher(teacher))
  }, [open, teacher, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ id: teacher.id, data: toUpdatePayload(values) })
      notify.success("Details saved")
      onOpenChange(false)
    } catch (error) {
      const message = errorText(error, "We couldn't save these details. Check them and try again.")
      const lower = message.toLowerCase()
      if (lower.includes("username") || (lower.includes("email") && !values.email.trim())) {
        setError("username", { message: "This username is taken. Try another." })
      } else if (lower.includes("email")) {
        setError("email", { message: "Someone at this school already uses this email. Use another, or leave it empty." })
      } else if (lower.includes("employee")) {
        setError("employee_id", { message: "Another teacher has this employee ID. Use another." })
      } else {
        notify.error(message)
      }
    }
  })

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!update.isPending) onOpenChange(next)
      }}
      title="Edit details"
      description={fullName(teacher)}
      className="sm:max-w-xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={update.isPending || !isDirty}>
            {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save details
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate>
        <TeacherDetailsFields register={register} errors={errors} departments={departments.data ?? []} mode="edit" />
      </form>
    </Sheet>
  )
}

export { EditTeacherSheet }
