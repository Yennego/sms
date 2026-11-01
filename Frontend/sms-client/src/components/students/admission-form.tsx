"use client"

// Admit a student (app flow §4.3): student details, guardian (existing or new), class for the
// current year. One save creates all three, or nothing.

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CalendarPlus, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageShell } from "@/components/ui/page-shell"
import { notify } from "@/components/ui/toaster"
import type { AdmissionRequest, AdmissionResponse, GuardianSearchResult } from "@/services/api/admissions-service"
import { CredentialsDialog } from "./credentials"
import { errorMessage, yearClassName } from "./format"
import { GuardianPicker } from "./guardian-picker"
import { useAdmitStudent, useCurrentYearClasses } from "./queries"

export const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "grandparent", label: "Grandparent" },
  { value: "sibling", label: "Brother or sister" },
  { value: "other", label: "Other relative" },
] as const

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter an email like name@example.com, or leave it empty")

const optionalUsername = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[a-zA-Z0-9._-]{3,50}$/.test(v), "Use 3 to 50 letters, numbers, dots, dashes or underscores, or leave it empty")

const schema = z
  .object({
    first_name: z.string().trim().min(1, "Enter the student's first name"),
    last_name: z.string().trim().min(1, "Enter the student's last name"),
    gender: z.enum(["female", "male"], { errorMap: () => ({ message: "Choose female or male" }) }),
    date_of_birth: z
      .string()
      .refine((v) => v === "" || v <= new Date().toISOString().slice(0, 10), "Enter a date of birth in the past"),
    admission_number: z.string().trim(),
    admission_date: z.string(),
    email: optionalEmail,
    username: optionalUsername,
    address: z.string().trim(),
    class_id: z.string().min(1, "Choose the class the student joins"),
    guardian_mode: z.enum(["existing", "new", "none"]),
    guardian_existing: z.custom<GuardianSearchResult | null>(),
    g_first_name: z.string().trim(),
    g_last_name: z.string().trim(),
    g_relationship: z.string(),
    g_phone: z.string().trim(),
    g_email: optionalEmail,
    g_username: optionalUsername,
  })
  .superRefine((v, ctx) => {
    if (v.guardian_mode === "existing" && !v.guardian_existing) {
      ctx.addIssue({ code: "custom", path: ["guardian_existing"], message: "Find and choose the guardian, or add a new one" })
    }
    if (v.guardian_mode === "new") {
      if (!v.g_first_name) ctx.addIssue({ code: "custom", path: ["g_first_name"], message: "Enter the guardian's first name" })
      if (!v.g_last_name) ctx.addIssue({ code: "custom", path: ["g_last_name"], message: "Enter the guardian's last name" })
      if (!v.g_relationship) ctx.addIssue({ code: "custom", path: ["g_relationship"], message: "Choose how they are related" })
      if (!/^\+?[0-9 ()-]{7,20}$/.test(v.g_phone)) {
        ctx.addIssue({ code: "custom", path: ["g_phone"], message: "Enter a phone number, e.g. +231 77 123 4567" })
      }
    }
  })

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  first_name: "",
  last_name: "",
  gender: "" as unknown as "female",
  date_of_birth: "",
  admission_number: "",
  admission_date: "",
  email: "",
  username: "",
  address: "",
  class_id: "",
  guardian_mode: "existing",
  guardian_existing: null,
  g_first_name: "",
  g_last_name: "",
  g_relationship: "",
  g_phone: "",
  g_email: "",
  g_username: "",
}

export const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:h-9 md:text-sm"

const inputClass = "h-11 text-base md:h-9 md:text-sm"

function toRequest(v: FormValues): AdmissionRequest {
  return {
    student: {
      first_name: v.first_name,
      last_name: v.last_name,
      gender: v.gender,
      date_of_birth: v.date_of_birth || null,
      email: v.email || null,
      username: v.username || null,
      admission_number: v.admission_number || null,
      admission_date: v.admission_date || null,
      address: v.address || null,
    },
    guardian:
      v.guardian_mode === "existing" && v.guardian_existing
        ? { existing_id: v.guardian_existing.id }
        : v.guardian_mode === "new"
          ? {
              existing_id: null,
              first_name: v.g_first_name,
              last_name: v.g_last_name,
              relationship_type: v.g_relationship,
              phone_number: v.g_phone,
              email: v.g_email || null,
              username: v.g_username || null,
            }
          : null,
    class_id: v.class_id,
  }
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 md:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

export function AdmissionForm({ school }: { school: string }) {
  const router = useRouter()
  const admit = useAdmitStudent()
  const { year, classes, isLoading: classesLoading, noCurrentYear } = useCurrentYearClasses()
  const [result, setResult] = React.useState<AdmissionResponse | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })

  const mode = watch("guardian_mode")
  const sortedClasses = React.useMemo(
    () => [...classes].sort((a, b) => yearClassName(a).localeCompare(yearClassName(b), undefined, { numeric: true })),
    [classes]
  )

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await admit.mutateAsync(toRequest(values))
      setResult(res)
    } catch (error) {
      notify.error(`${errorMessage(error, "The student wasn't saved.")} Nothing was saved; fix this and try again.`)
    }
  })

  const admitAnother = () => {
    setResult(null)
    reset(defaults)
    setTimeout(() => setFocus("first_name"), 50)
  }

  if (noCurrentYear) {
    return (
      <PageShell title="Admit a student">
        <EmptyState
          icon={CalendarPlus}
          title="No current school year"
          description="Students join a class of the current school year. Set up the year and its classes first."
          action={
            <Button asChild>
              <Link href={`/${school}/academics/academic-years`}>Set up the school year</Link>
            </Button>
          }
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Admit a student"
      description="Creates the student, their guardian's account and the class enrollment together. If any part fails, nothing is saved."
      eyebrow={
        <Link href={`/${school}/students`} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
          ← Students
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex max-w-4xl flex-col gap-6">
        <Section title="Student">
          <FormField label="First name" error={errors.first_name?.message} required>
            <Input {...register("first_name")} autoComplete="off" className={inputClass} />
          </FormField>
          <FormField label="Last name" error={errors.last_name?.message} required>
            <Input {...register("last_name")} autoComplete="off" className={inputClass} />
          </FormField>
          <FormField label="Gender" error={errors.gender?.message} required>
            <select {...register("gender")} className={selectClass}>
              <option value="">Choose</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </FormField>
          <FormField label="Date of birth" error={errors.date_of_birth?.message}>
            <Input type="date" {...register("date_of_birth")} className={inputClass} />
          </FormField>
          <FormField
            label="Admission number"
            error={errors.admission_number?.message}
            description="Leave empty to get the next number."
          >
            <Input {...register("admission_number")} autoComplete="off" className={inputClass} />
          </FormField>
          <FormField label="Admission date" error={errors.admission_date?.message} description="Leave empty for today.">
            <Input type="date" {...register("admission_date")} className={inputClass} />
          </FormField>
          <FormField label="Username" error={errors.username?.message} description="Leave empty to make one from the name.">
            <Input {...register("username")} autoComplete="off" autoCapitalize="none" className={inputClass} />
          </FormField>
          <FormField label="Email" error={errors.email?.message} description="Optional.">
            <Input type="email" {...register("email")} autoComplete="off" className={inputClass} />
          </FormField>
          <FormField label="Home address" error={errors.address?.message} className="md:col-span-2">
            <Input {...register("address")} className={inputClass} />
          </FormField>
        </Section>

        <section className="rounded-xl border bg-card p-4 md:p-6">
          <h2 className="text-base font-semibold text-foreground">Guardian</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The parent or guardian who signs in to follow this student. Brothers and sisters share one guardian.
          </p>
          <Controller
            control={control}
            name="guardian_mode"
            render={({ field }) => (
              <fieldset className="mt-4">
                <legend className="sr-only">Guardian</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["existing", "Find an existing guardian"],
                      ["new", "Add a new guardian"],
                      ["none", "No guardian yet"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                        field.value === value && "border-primary bg-primary/5 font-medium"
                      )}
                    >
                      <input
                        type="radio"
                        className="size-4 accent-[var(--primary)]"
                        checked={field.value === value}
                        onChange={() => field.onChange(value)}
                        name={field.name}
                        value={value}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          />

          <div className="mt-4">
            {mode === "existing" ? (
              <Controller
                control={control}
                name="guardian_existing"
                render={({ field, fieldState }) => (
                  <FormField label="Guardian" error={fieldState.error?.message} required>
                    {(props) => <GuardianPicker {...props} value={field.value ?? null} onChange={field.onChange} />}
                  </FormField>
                )}
              />
            ) : mode === "new" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="First name" error={errors.g_first_name?.message} required>
                  <Input {...register("g_first_name")} autoComplete="off" className={inputClass} />
                </FormField>
                <FormField label="Last name" error={errors.g_last_name?.message} required>
                  <Input {...register("g_last_name")} autoComplete="off" className={inputClass} />
                </FormField>
                <FormField label="Relationship to the student" error={errors.g_relationship?.message} required>
                  <select {...register("g_relationship")} className={selectClass}>
                    <option value="">Choose</option>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Phone number"
                  error={errors.g_phone?.message}
                  description="Used to sign in and for school messages."
                  required
                >
                  <Input type="tel" inputMode="tel" {...register("g_phone")} autoComplete="off" className={inputClass} />
                </FormField>
                <FormField label="Username" error={errors.g_username?.message} description="Leave empty to make one from the name.">
                  <Input {...register("g_username")} autoComplete="off" autoCapitalize="none" className={inputClass} />
                </FormField>
                <FormField label="Email" error={errors.g_email?.message} description="Optional.">
                  <Input type="email" {...register("g_email")} autoComplete="off" className={inputClass} />
                </FormField>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can add a guardian later from the student&apos;s profile (Guardians tab).
              </p>
            )}
          </div>
        </section>

        <Section
          title="Class"
          description={year ? `The class the student joins in ${year.name}.` : "The class the student joins this school year."}
        >
          <FormField label="Class" error={errors.class_id?.message} required>
            <select {...register("class_id")} className={selectClass} disabled={classesLoading}>
              <option value="">{classesLoading ? "Loading classes…" : "Choose a class"}</option>
              {sortedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {yearClassName(c)}
                </option>
              ))}
            </select>
          </FormField>
          {!classesLoading && classes.length === 0 ? (
            <p className="self-end text-sm text-muted-foreground">
              This year has no classes yet.{" "}
              <Link href={`/${school}/academics/classes`} className="font-medium text-primary underline-offset-4 hover:underline">
                Create classes
              </Link>{" "}
              first.
            </p>
          ) : null}
        </Section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>*]:min-h-11 md:[&>*]:min-h-9">
          <Button asChild variant="outline">
            <Link href={`/${school}/students`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={admit.isPending}>
            {admit.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Admit student
          </Button>
        </div>
      </form>

      <CredentialsDialog
        open={Boolean(result)}
        onOpenChange={(open) => {
          if (!open) setResult(null)
        }}
        title={result ? `${result.student.name} is admitted to ${result.enrollment.class_name}` : ""}
        printTitle={result ? `Sign-in details: ${result.student.name}` : ""}
        credentials={result?.credentials ?? []}
        description={
          result?.guardian && !result.guardian.created
            ? `Linked to ${result.guardian.name}, who already has an account. These passwords are shown only once: copy or print them now.`
            : undefined
        }
        actions={
          result ? (
            <>
              <Button type="button" variant="outline" onClick={admitAnother}>
                Admit another
              </Button>
              <Button type="button" onClick={() => router.push(`/${school}/students/${result.student.id}`)}>
                Open student profile
              </Button>
            </>
          ) : null
        }
      />
    </PageShell>
  )
}
