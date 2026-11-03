"use client"

// "Add staff member" on the Users page (POST /auth/staff-accounts): a sign-in with one staff role.
// Teachers are added under Staff instead, so they get a teacher record. The new password comes
// back once and is shown by the caller.

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { notify } from "@/components/ui/toaster"
import { errorMessage } from "@/components/students/format"
import { useTenant } from "@/hooks/use-tenant"
import {
  useUserDirectoryService,
  type StaffAccountCreate,
  type StaffAccountCreated,
} from "@/services/api/user-directory-service"

import { roleLabel } from "./role-labels"

const USERNAME_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

const schema = z.object({
  first_name: z.string().trim().min(1, "Enter the first name").max(100, "First name can be at most 100 characters"),
  last_name: z.string().trim().min(1, "Enter the last name").max(100, "Last name can be at most 100 characters"),
  role_id: z.string().min(1, "Choose a role"),
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
  phone_number: z.string().trim().max(20, "Phone number can be at most 20 characters"),
})

type Values = z.infer<typeof schema>

const empty: Values = { first_name: "", last_name: "", role_id: "", email: "", username: "", phone_number: "" }

const inputClass = "h-11 md:h-10"
const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-10 md:text-sm"

export interface AddStaffSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (created: StaffAccountCreated) => void
}

function AddStaffSheet({ open, onOpenChange, onCreated }: AddStaffSheetProps) {
  const formId = React.useId()
  const service = useUserDirectoryService()
  const { tenantKey } = useTenant()

  const roles = useQuery({
    queryKey: ["users", tenantKey, "staff-roles"],
    queryFn: () => service.staffRoles(),
    enabled: open && Boolean(tenantKey),
  })
  const create = useMutation({ mutationFn: (data: StaffAccountCreate) => service.createStaffAccount(data) })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })

  React.useEffect(() => {
    if (open) reset(empty)
  }, [open, reset])

  const onSubmit = handleSubmit(async (values) => {
    const payload: StaffAccountCreate = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      role_id: values.role_id,
    }
    if (values.email.trim()) payload.email = values.email.trim()
    if (values.username.trim()) payload.username = values.username.trim().toLowerCase()
    if (values.phone_number.trim()) payload.phone_number = values.phone_number.trim()
    try {
      const created = await create.mutateAsync(payload)
      onOpenChange(false)
      onCreated(created)
    } catch (error) {
      const message = errorMessage(error, "We couldn't create the account.")
      const lower = message.toLowerCase()
      if (lower.includes("username")) setError("username", { message })
      else if (lower.includes("email")) setError("email", { message })
      else if (lower.includes("role")) setError("role_id", { message })
      else notify.error(`${message} Check the details and try again.`)
    }
  })

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!create.isPending) onOpenChange(next)
      }}
      title="Add staff member"
      description="They get a sign-in with one role. Add teachers under Staff, then Add teacher."
      className="sm:max-w-xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Create account
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" required error={errors.first_name?.message}>
          <Input autoComplete="off" className={inputClass} {...register("first_name")} />
        </FormField>
        <FormField label="Last name" required error={errors.last_name?.message}>
          <Input autoComplete="off" className={inputClass} {...register("last_name")} />
        </FormField>
        <FormField
          label="Role"
          required
          className="sm:col-span-2"
          error={
            errors.role_id?.message ??
            (roles.isError ? `${errorMessage(roles.error, "The roles didn't load.")} Close this and try again.` : undefined)
          }
        >
          <select className={selectClass} disabled={roles.isLoading} {...register("role_id")}>
            <option value="">{roles.isLoading ? "Loading roles…" : "Choose a role"}</option>
            {(roles.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {roleLabel(r.name)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Email"
          error={errors.email?.message}
          description="Optional. They can sign in with their username instead."
        >
          <Input type="email" inputMode="email" autoComplete="off" className={inputClass} {...register("email")} />
        </FormField>
        <FormField
          label="Username"
          error={errors.username?.message}
          description="Optional. Leave empty and we'll make one from the name, like ama.kollie."
        >
          <Input autoComplete="off" autoCapitalize="none" spellCheck={false} className={inputClass} {...register("username")} />
        </FormField>
        <FormField label="Phone number" error={errors.phone_number?.message} className="sm:col-span-2">
          <Input type="tel" inputMode="tel" autoComplete="off" className={inputClass} {...register("phone_number")} />
        </FormField>
      </form>
    </Sheet>
  )
}

export { AddStaffSheet }
