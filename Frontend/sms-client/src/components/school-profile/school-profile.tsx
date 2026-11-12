"use client"

// School profile (phase4-design.md section 6): what report cards print about the school besides
// its name — address, motto, phone, email, the principal (and the title printed under their
// signature), an optional school seal, and the logo (also used on the sign-in page, header and
// receipts). Needs manage_tenant_settings; a 403 from the server is shown as a plain message.

import * as React from "react"
import Link from "next/link"
import { ImageIcon, Loader2, Lock, RefreshCw, Stamp, Trash2 } from "lucide-react"

import { ImagePicker, type PickedImage } from "@/components/signature/image-picker"
import { errorText, statusOf } from "@/components/signature/errors"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageShell } from "@/components/ui/page-shell"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { notify } from "@/components/ui/toaster"
import type { SchoolProfile as Profile, StaffOption } from "@/services/api/school-profile-service"

import {
  usePrincipalCandidates,
  useRemoveLogo,
  useRemoveSeal,
  useSaveLogo,
  useSaveSeal,
  useSchoolProfile,
  useUpdateSchoolProfile,
} from "./queries"

const NO_PRINCIPAL = "__none__"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Values = {
  address: string
  motto: string
  phone: string
  email: string
  principal_user_id: string
  principal_title: string
}

function valuesOf(p: Profile): Values {
  return {
    address: p.address ?? "",
    motto: p.motto ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    principal_user_id: p.principal_user_id ?? NO_PRINCIPAL,
    principal_title: p.principal_title || "Principal",
  }
}

const orNull = (s: string) => (s.trim() === "" ? null : s.trim())

function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateSchoolProfile()
  const staff = usePrincipalCandidates(true)
  const [values, setValues] = React.useState<Values>(() => valuesOf(profile))
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>>>({})

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  // Keep the current principal in the list even if they aren't returned (e.g. now inactive).
  const options: StaffOption[] = React.useMemo(() => {
    const list = staff.data ?? []
    if (profile.principal_user_id && !list.some((s) => s.id === profile.principal_user_id)) {
      return [{ id: profile.principal_user_id, name: profile.principal_name ?? "Current principal", kind: "Current" }, ...list]
    }
    return list
  }, [staff.data, profile.principal_user_id, profile.principal_name])

  const dirty = JSON.stringify(values) !== JSON.stringify(valuesOf(profile))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) next.email = "Enter an email address like office@school.edu.lr, or leave it empty."
    if (!values.principal_title.trim()) next.principal_title = "Enter the title printed under the principal's signature, for example Principal."
    setErrors(next)
    if (Object.keys(next).length > 0) return
    try {
      await update.mutateAsync({
        address: orNull(values.address),
        motto: orNull(values.motto),
        phone: orNull(values.phone),
        email: orNull(values.email),
        principal_user_id: values.principal_user_id === NO_PRINCIPAL ? null : values.principal_user_id,
        principal_title: values.principal_title.trim(),
      })
      notify.success("School profile saved. Report cards show it from now on.")
    } catch (error) {
      notify.error(
        statusOf(error) === 403
          ? "Your account can't change the school profile. Ask an administrator."
          : `${errorText(error, "The school profile wasn't saved.")} Check the fields and try again.`
      )
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <section className="rounded-xl border p-4 md:p-6" aria-labelledby="sp-contact">
        <h2 id="sp-contact" className="text-base font-semibold">
          Printed on report cards
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField label="Address" className="md:col-span-2" error={errors.address}>
            <Textarea value={values.address} onChange={set("address")} rows={2} placeholder="e.g. Tubman Boulevard, Sinkor, Monrovia" />
          </FormField>
          <FormField label="Motto" className="md:col-span-2">
            <Input value={values.motto} onChange={set("motto")} placeholder="e.g. Knowledge is light" className="min-h-11 md:min-h-9" />
          </FormField>
          <FormField label="Phone">
            <Input type="tel" inputMode="tel" value={values.phone} onChange={set("phone")} className="min-h-11 md:min-h-9" />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <Input type="email" inputMode="email" value={values.email} onChange={set("email")} className="min-h-11 md:min-h-9" />
          </FormField>
        </div>
      </section>

      <section className="rounded-xl border p-4 md:p-6" aria-labelledby="sp-principal">
        <h2 id="sp-principal" className="text-base font-semibold">
          Principal
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The principal&rsquo;s signature is printed on every report card when results are published. Each person adds their own signature under My signature.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField
            label="Who signs as principal"
            description={
              staff.isError
                ? `${errorText(staff.error, "The staff list couldn't be loaded.")} You can still save the other fields.`
                : staff.isLoading
                  ? "Loading staff…"
                  : options.length === 0
                    ? "No active teachers or office staff were found."
                    : undefined
            }
          >
            {(controlProps) => (
              <Select
                value={values.principal_user_id}
                onValueChange={(v) => setValues((s) => ({ ...s, principal_user_id: v }))}
              >
                <SelectTrigger {...controlProps} className="min-h-11 w-full md:min-h-9">
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PRINCIPAL}>No principal chosen</SelectItem>
                  {options.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField
            label="Title under the signature"
            required
            error={errors.principal_title}
            description="For example Principal, Headmaster or Head teacher."
          >
            <Input value={values.principal_title} onChange={set("principal_title")} className="min-h-11 md:min-h-9" />
          </FormField>
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" className="min-h-11" disabled={!dirty || update.isPending}>
          {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Save school profile
        </Button>
      </div>
    </form>
  )
}

interface ImageCardProps {
  id: string
  icon: React.ComponentType<{ className?: string }>
  /** "School seal", "School logo" */
  title: string
  /** "seal", "logo" */
  noun: string
  description: React.ReactNode
  hint: string
  /** The current image (a data URL or an address), or null */
  current: string | null
  /** Whether "Remove" applies to the current image (a logo given as a web address isn't removed here) */
  removable: boolean
  removeDescription: string
  save: { mutateAsync: (v: { file: Blob; filename: string }) => Promise<unknown>; isPending: boolean }
  remove: { mutateAsync: () => Promise<unknown>; isPending: boolean }
}

// An optional image of the school (seal, logo): show it, replace it, remove it
function ImageCard({ id, icon: Icon, title, noun, description, hint, current, removable, removeDescription, save, remove }: ImageCardProps) {
  const [picked, setPicked] = React.useState<PickedImage | null>(null)
  const [confirm, setConfirm] = React.useState(false)

  const onSave = async () => {
    if (!picked) return
    try {
      await save.mutateAsync({ file: picked.file, filename: picked.filename })
      setPicked(null)
      notify.success(`${title} saved.`)
    } catch (error) {
      notify.error(`${errorText(error, `The ${noun} wasn't saved.`)} Try again.`)
    }
  }

  return (
    <section className="rounded-xl border p-4 md:p-6" aria-labelledby={id}>
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {current ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex size-32 items-center justify-center rounded-xl border bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL or the school's own image address */}
            <img src={current} alt={`Current ${title.toLowerCase()}`} className="max-h-full max-w-full object-contain" />
          </div>
          {removable ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 text-destructive"
              onClick={() => setConfirm(true)}
              disabled={remove.isPending}
            >
              <Trash2 aria-hidden="true" />
              Remove {noun}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <ImagePicker
          what={title.toLowerCase()}
          value={picked}
          onChange={setPicked}
          previewClassName="h-40"
          disabled={save.isPending}
          hint={hint}
        />
      </div>
      {picked ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" className="min-h-11" onClick={onSave} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {current ? `Replace ${noun}` : `Save ${noun}`}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove the ${title.toLowerCase()}?`}
        description={removeDescription}
        confirmLabel={`Remove ${noun}`}
        destructive
        onConfirm={async () => {
          try {
            await remove.mutateAsync()
            notify.success(`${title} removed.`)
          } catch (error) {
            notify.error(`${errorText(error, `The ${noun} wasn't removed.`)} Try again.`)
            throw error
          }
        }}
      />
    </section>
  )
}

function LogoCard({ profile }: { profile: Profile }) {
  const save = useSaveLogo()
  const remove = useRemoveLogo()
  return (
    <ImageCard
      id="sp-logo"
      icon={ImageIcon}
      title="School logo"
      noun="logo"
      description="Shown on your sign-in page, at the top of the app, on receipts and on report cards."
      hint="A square image on a plain or clear background works best. PNG or JPEG, up to 1 MB."
      current={profile.logo}
      removable={profile.logo_uploaded}
      removeDescription="Your sign-in page, receipts and report cards will show no logo. You can upload it again at any time."
      save={save}
      remove={remove}
    />
  )
}

function SealCard({ profile }: { profile: Profile }) {
  const save = useSaveSeal()
  const remove = useRemoveSeal()
  return (
    <ImageCard
      id="sp-seal"
      icon={Stamp}
      title="School seal"
      noun="seal"
      description={<>Optional. Printed next to the principal&rsquo;s signature.</>}
      hint="A clear photo or scan of the stamp on white paper. PNG or JPEG, up to 1 MB."
      current={profile.seal}
      removable
      removeDescription="Report cards will print without a seal. You can upload it again at any time."
      save={save}
      remove={remove}
    />
  )
}

export function SchoolProfile({ school }: { school: string }) {
  const query = useSchoolProfile()
  const status = statusOf(query.error)

  return (
    <PageShell
      title="School profile"
      description="What report cards print about your school: logo, address, motto, contacts, the principal and the school seal."
      className="max-w-4xl"
    >
      <p className="rounded-xl border bg-muted/40 p-4 text-sm">
        The app&rsquo;s logo and colours are under{" "}
        <Link href={`/${school}/settings/tenant`} className="font-medium text-primary underline underline-offset-4">
          Logo and colours
        </Link>
        . The school&rsquo;s name is set by the platform operator.
      </p>

      {query.isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : query.isError ? (
        status === 403 ? (
          <EmptyState
            icon={Lock}
            title="You can't change the school profile"
            description={`${errorText(query.error, "Your account doesn't have permission.")} Ask an administrator who can manage school settings.`}
          />
        ) : (
          <EmptyState
            icon={RefreshCw}
            title="Couldn't load the school profile"
            description={`${errorText(query.error, "The server didn't answer.")} Check your connection and try again.`}
            action={
              <Button variant="outline" onClick={() => query.refetch()}>
                Try again
              </Button>
            }
          />
        )
      ) : query.data ? (
        <>
          <ProfileForm key={query.data.updated_at ?? "profile"} profile={query.data} />
          <LogoCard profile={query.data} />
          <SealCard profile={query.data} />
        </>
      ) : null}
    </PageShell>
  )
}
