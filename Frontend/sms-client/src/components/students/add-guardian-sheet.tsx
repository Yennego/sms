"use client"

// Add a guardian to a student already admitted: find one who already has children at the school
// (brothers and sisters share one guardian), or add a new one, who gets a parent sign-in shown once.

import * as React from "react"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { notify } from "@/components/ui/toaster"
import type {
  AdmissionCredential,
  GuardianSearchResult,
} from "@/services/api/admissions-service"
import { RELATIONSHIPS, selectClass } from "./admission-form"
import { errorMessage } from "./format"
import { GuardianPicker } from "./guardian-picker"
import { useGuardianLinks } from "./queries"

const inputClass = "h-11 text-base md:h-9 md:text-sm"
const EMPTY = {
  first_name: "",
  last_name: "",
  relationship_type: "",
  phone_number: "",
  email: "",
  username: "",
}

export function AddGuardianSheet({
  open,
  onOpenChange,
  studentId,
  studentName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  studentName: string
  /** A new guardian's sign-in, to show once. */
  onCreated: (credentials: AdmissionCredential[]) => void
}) {
  const { add } = useGuardianLinks(studentId)
  const [mode, setMode] = React.useState<"existing" | "new">("existing")
  const [existing, setExisting] = React.useState<GuardianSearchResult | null>(
    null,
  )
  const [fields, setFields] = React.useState(EMPTY)
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof typeof EMPTY | "existing", string>>
  >({})

  React.useEffect(() => {
    if (!open) {
      setMode("existing")
      setExisting(null)
      setFields(EMPTY)
      setErrors({})
    }
  }, [open])

  const set =
    (key: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problems: typeof errors = {}
    if (mode === "existing" && !existing)
      problems.existing = "Find and choose the guardian, or add a new one"
    if (mode === "new") {
      if (!fields.first_name.trim())
        problems.first_name = "Enter the guardian's first name"
      if (!fields.last_name.trim())
        problems.last_name = "Enter the guardian's last name"
      if (!fields.relationship_type)
        problems.relationship_type =
          "Choose how they're related to the student"
    }
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    try {
      const result = await add.mutateAsync(
        mode === "existing" && existing
          ? { existing_id: existing.id }
          : {
              existing_id: null,
              ...fields,
              email: fields.email || null,
              username: fields.username || null,
            },
      )
      notify.success(
        `${result.guardian.name} is now a guardian of ${studentName}`,
      )
      onOpenChange(false)
      if (result.credentials.length > 0) onCreated(result.credentials)
    } catch (error) {
      notify.error(
        `${errorMessage(error, "The guardian wasn't added.")} Check the details and try again.`,
      )
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add a guardian"
      description={`The parent or guardian who signs in to follow ${studentName}. Brothers and sisters share one guardian.`}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 md:min-h-9"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-guardian-form"
            className="min-h-11 md:min-h-9"
            disabled={add.isPending}
          >
            {add.isPending ? "Adding…" : "Add guardian"}
          </Button>
        </div>
      }
    >
      <form
        id="add-guardian-form"
        onSubmit={submit}
        className="flex flex-col gap-4"
        noValidate
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Guardian</legend>
          {(
            [
              ["existing", "Find an existing guardian"],
              ["new", "Add a new guardian"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 items-center gap-2 text-sm md:min-h-9"
            >
              <input
                type="radio"
                name="guardian_mode"
                value={value}
                checked={mode === value}
                onChange={() => {
                  setMode(value)
                  setErrors({})
                }}
                className="size-4"
              />
              {label}
            </label>
          ))}
        </fieldset>

        {mode === "existing" ? (
          <FormField
            label="Guardian"
            error={errors.existing}
            description="Search by name, username, email or phone."
            required
          >
            {(props) => (
              <GuardianPicker
                {...props}
                value={existing}
                onChange={setExisting}
              />
            )}
          </FormField>
        ) : (
          <div className="grid gap-4">
            <FormField label="First name" error={errors.first_name} required>
              <Input
                value={fields.first_name}
                onChange={set("first_name")}
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField label="Last name" error={errors.last_name} required>
              <Input
                value={fields.last_name}
                onChange={set("last_name")}
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField
              label="Relationship to the student"
              error={errors.relationship_type}
              required
            >
              <select
                value={fields.relationship_type}
                onChange={set("relationship_type")}
                className={selectClass}
              >
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
              description="For school messages and calls."
            >
              <Input
                type="tel"
                inputMode="tel"
                value={fields.phone_number}
                onChange={set("phone_number")}
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField
              label="Username"
              description="Leave empty to make one from the name."
            >
              <Input
                value={fields.username}
                onChange={set("username")}
                autoComplete="off"
                autoCapitalize="none"
                className={inputClass}
              />
            </FormField>
            <FormField label="Email" description="Optional.">
              <Input
                type="email"
                value={fields.email}
                onChange={set("email")}
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
          </div>
        )}
      </form>
    </Sheet>
  )
}
