"use client"

// Add a teacher. Email and username are optional (people sign in with either; the username is made
// from the name when empty). On success the sign-in details are shown once, with the next steps.

import * as React from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, CheckCircle2, Loader2, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/ui/page-shell"
import { notify } from "@/components/ui/toaster"
import type { StaffCreateResult } from "@/services/api/staff-service"

import { useAddTeacher, useStaffDepartments } from "./use-staff"
import {
  TeacherDetailsFields,
  emptyTeacherDetails,
  teacherDetailsSchema,
  toCreatePayload,
  type TeacherDetailsValues,
} from "./teacher-details-fields"
import { CredentialsCard, type CredentialItem } from "./credentials-card"
import { errorText, fullName } from "./staff-format"

export interface AddTeacherFormProps {
  schoolSlug: string
}

function AddTeacherForm({ schoolSlug }: AddTeacherFormProps) {
  const base = `/${schoolSlug}/teachers`
  const departments = useStaffDepartments()
  const addTeacher = useAddTeacher()
  const [created, setCreated] = React.useState<StaffCreateResult | null>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<TeacherDetailsValues>({
    resolver: zodResolver(teacherDetailsSchema),
    defaultValues: emptyTeacherDetails,
  })

  React.useEffect(() => {
    if (created) headingRef.current?.focus()
  }, [created])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await addTeacher.mutateAsync(toCreatePayload(values))
      setCreated(result)
      notify.success(`${fullName(result)} was added`)
    } catch (error) {
      const message = errorText(error, "We couldn't add this teacher. Check the details and try again.")
      const lower = message.toLowerCase()
      // The API client reports any unique-key clash as "Email already exists", so without an email
      // it can only be the username.
      if (lower.includes("username") || (lower.includes("email") && !values.email.trim())) {
        setError("username", { message: "This username is taken. Try another, or leave it empty." })
        setFocus("username")
      } else if (lower.includes("email")) {
        setError("email", { message: "Someone at this school already uses this email. Use another, or leave it empty." })
        setFocus("email")
      } else if (lower.includes("employee id")) {
        setError("employee_id", { message: "Another teacher has this employee ID. Use another, or leave it empty." })
        setFocus("employee_id")
      } else {
        notify.error(message)
      }
    }
  })

  const addAnother = () => {
    setCreated(null)
    reset(emptyTeacherDetails)
    addTeacher.reset()
  }

  const backLink = (
    <Link href={base} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-0">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Staff
    </Link>
  )

  if (created) {
    const items: CredentialItem[] = []
    if (created.username) items.push({ label: "Username", value: created.username })
    if (created.email) items.push({ label: "Email", value: created.email })
    if (created.generated_password) items.push({ label: "Password", value: created.generated_password })

    return (
      <PageShell title="Add a teacher" eyebrow={backLink}>
        <section aria-labelledby="added-heading" className="flex max-w-xl flex-col gap-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-green-700" aria-hidden="true" />
            <div>
              <h2 id="added-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
                {fullName(created)} was added
              </h2>
              <p className="text-sm text-muted-foreground">Employee ID {created.employee_id}</p>
            </div>
          </div>
          {items.length > 0 ? (
            <CredentialsCard
              items={items}
              note={
                created.generated_password
                  ? "Copy or write these down now: the password won't be shown again. They'll choose their own password when they first sign in."
                  : "They'll choose their own password when they first sign in."
              }
            />
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="min-h-11 md:min-h-9">
              <Link href={`${base}/${created.id}`}>Open profile</Link>
            </Button>
            <Button variant="outline" className="min-h-11 md:min-h-9" onClick={addAnother}>
              <UserPlus aria-hidden="true" />
              Add another
            </Button>
          </div>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Add a teacher"
      description="Only the name is required. We'll make a username and password for you to hand over."
      eyebrow={backLink}
    >
      <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-6">
        <TeacherDetailsFields register={register} errors={errors} departments={departments.data ?? []} mode="create" />
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" className="min-h-11 md:min-h-9">
            <Link href={base}>Cancel</Link>
          </Button>
          <Button type="submit" className="min-h-11 md:min-h-9" disabled={addTeacher.isPending}>
            {addTeacher.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Add teacher
          </Button>
        </div>
      </form>
    </PageShell>
  )
}

export { AddTeacherForm }
