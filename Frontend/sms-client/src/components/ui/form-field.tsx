"use client"

// FormField: label + control + description + error, with id / aria-describedby / aria-invalid wiring.
//
// With register:
//   <FormField label="First name" error={errors.firstName?.message} required>
//     <Input {...register("firstName")} />
//   </FormField>
//
// Inside <FormProvider> you can pass `name` instead of `error`; the error is read from form state.
//
// With a controlled child, use the render prop and spread the wiring props:
//   <Controller name="gender" control={control} render={({ field, fieldState }) => (
//     <FormField label="Gender" error={fieldState.error?.message}>
//       {(controlProps) => <Select value={field.value} onValueChange={field.onChange}>
//         <SelectTrigger {...controlProps}>...</SelectTrigger>...</Select>}
//     </FormField>
//   )} />

import * as React from "react"
import { get, useFormContext, type FieldValues } from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

export interface FormFieldControlProps {
  id: string
  "aria-describedby"?: string
  "aria-invalid"?: true
  "aria-required"?: true
}

export interface FormFieldProps {
  label: React.ReactNode
  /** Field name; used to read the error from FormProvider context when `error` isn't given. */
  name?: string
  /** Control id. Generated if omitted (or taken from the child's id). */
  id?: string
  description?: React.ReactNode
  /** Error message. Say what to do, e.g. "Enter a date after the start date". */
  error?: string
  required?: boolean
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean
  className?: string
  children: React.ReactElement<Record<string, unknown>> | ((props: FormFieldControlProps) => React.ReactNode)
}

function useContextError(name?: string): string | undefined {
  // useFormContext returns null outside a FormProvider.
  const ctx = useFormContext<FieldValues>() as ReturnType<typeof useFormContext<FieldValues>> | null
  if (!ctx || !name) return undefined
  const fieldError = get(ctx.formState.errors, name) as { message?: unknown } | undefined
  return typeof fieldError?.message === "string" ? fieldError.message : undefined
}

function FormField({
  label,
  name,
  id: idProp,
  description,
  error: errorProp,
  required,
  hideLabel,
  className,
  children,
}: FormFieldProps) {
  const generatedId = React.useId()
  const contextError = useContextError(name)
  const error = errorProp ?? contextError

  const childId =
    typeof children !== "function" && React.isValidElement(children) && typeof children.props.id === "string"
      ? children.props.id
      : undefined
  const id = idProp ?? childId ?? `field-${generatedId}`
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined

  const controlProps: FormFieldControlProps = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    "aria-required": required ? true : undefined,
  }

  let control: React.ReactNode
  if (typeof children === "function") {
    control = children(controlProps)
  } else if (React.isValidElement(children)) {
    const existing = children.props["aria-describedby"]
    control = React.cloneElement(children, {
      ...controlProps,
      "aria-describedby":
        [typeof existing === "string" ? existing : undefined, describedBy].filter(Boolean).join(" ") ||
        undefined,
    })
  } else {
    control = children
  }

  return (
    <div data-slot="form-field" data-invalid={error ? "true" : undefined} className={cn("grid gap-2", className)}>
      <Label htmlFor={id} className={cn(error && "text-destructive", hideLabel && "sr-only")}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </Label>
      {control}
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { FormField }
