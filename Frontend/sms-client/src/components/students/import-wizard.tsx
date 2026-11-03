"use client"

// Import admissions from a spreadsheet: upload → match columns → check rows (dry run) →
// import → hand over the sign-in details.

import * as React from "react"
import Link from "next/link"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageShell } from "@/components/ui/page-shell"
import { StatusBadge } from "@/components/ui/status-badge"
import { notify } from "@/components/ui/toaster"
import {
  ADMISSION_ROW_FIELDS,
  MAX_IMPORT_ROWS,
  type AdmissionRow,
  type ImportResponse,
} from "@/services/api/admissions-service"
import { selectClass } from "./admission-form"
import { CredentialsActions } from "./credentials"
import { errorMessage, yearClassName } from "./format"
import { useCurrentYearClasses, useImportAdmissions } from "./queries"

type Field = keyof AdmissionRow

const FIELD_INFO: Record<Field, { label: string; required?: boolean; aliases: string[] }> = {
  first_name: { label: "First name", required: true, aliases: ["firstname", "first", "givenname", "studentfirstname"] },
  last_name: { label: "Last name", required: true, aliases: ["lastname", "last", "surname", "familyname", "studentlastname"] },
  gender: { label: "Gender", aliases: ["sex"] },
  date_of_birth: { label: "Date of birth", aliases: ["dob", "dateofbirth", "birthdate", "birthday"] },
  email: { label: "Email", aliases: ["email", "emailaddress", "studentemail"] },
  username: { label: "Username", aliases: ["username", "user", "login"] },
  admission_number: { label: "Admission number", aliases: ["admissionnumber", "admissionno", "admno", "studentid", "idnumber"] },
  class_name: { label: "Class", required: true, aliases: ["class", "classname", "grade", "gradesection"] },
  guardian_first_name: { label: "Guardian first name", aliases: ["guardianfirstname", "parentfirstname"] },
  guardian_last_name: { label: "Guardian last name", aliases: ["guardianlastname", "parentlastname", "guardiansurname"] },
  guardian_relationship: { label: "Guardian relationship", aliases: ["guardianrelationship", "relationship", "relation"] },
  guardian_phone: {
    label: "Guardian phone",
    aliases: ["guardianphone", "parentphone", "guardianphonenumber", "phone", "phonenumber", "guardiancontact"],
  },
  guardian_email: { label: "Guardian email", aliases: ["guardianemail", "parentemail"] },
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

interface ParsedFile {
  name: string
  headers: string[]
  /** Data rows with their row number in the file (header = row 1). */
  rows: { fileRow: number; cells: string[] }[]
}

type Mapping = Record<Field, string> // field → header ("" = not in the file)

function autoMap(headers: string[]): Mapping {
  const normalized = headers.map(norm)
  const used = new Set<number>()
  const mapping = {} as Mapping
  for (const field of ADMISSION_ROW_FIELDS) {
    const candidates = [norm(field), ...FIELD_INFO[field].aliases]
    const idx = normalized.findIndex((h, i) => !used.has(i) && candidates.includes(h))
    if (idx >= 0) used.add(idx)
    mapping[field] = idx >= 0 ? headers[idx] : ""
  }
  return mapping
}

async function readMatrix(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith(".csv")) {
    const text = await file.text()
    const result = Papa.parse<string[]>(text, { skipEmptyLines: false })
    return result.data.map((r) => r.map((c) => String(c ?? "")))
  }
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array", cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    dateNF: "yyyy-mm-dd",
    defval: "",
    blankrows: true,
  }).map((r) => r.map((c) => String(c ?? "")))
}

function downloadTemplate() {
  const csv = ADMISSION_ROW_FIELDS.join(",") + "\r\n"
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "admissions-template.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="rounded-xl border bg-card p-4 md:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-sm",
            done ? "bg-green-100 text-green-800" : "bg-muted text-foreground"
          )}
          aria-hidden="true"
        >
          {done ? <CheckCircle2 className="size-4" /> : n}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function ImportWizard({ school }: { school: string }) {
  const importer = useImportAdmissions()
  const { classes } = useCurrentYearClasses()
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = React.useState<ParsedFile | null>(null)
  const [mapping, setMapping] = React.useState<Mapping | null>(null)
  const [check, setCheck] = React.useState<ImportResponse | null>(null)
  const [done, setDone] = React.useState<ImportResponse | null>(null)
  const [onlyProblems, setOnlyProblems] = React.useState(false)
  const [reading, setReading] = React.useState(false)
  // A sheet often holds one class: this class fills every row whose class cell is empty.
  const [defaultClass, setDefaultClass] = React.useState("")

  const namedClasses = React.useMemo(
    () =>
      classes
        .filter((c) => c.name)
        .sort((a, b) => yearClassName(a).localeCompare(yearClassName(b), undefined, { numeric: true })),
    [classes]
  )

  const rows: AdmissionRow[] = React.useMemo(() => {
    if (!parsed || !mapping) return []
    const index = Object.fromEntries(parsed.headers.map((h, i) => [h, i]))
    return parsed.rows.map(({ cells }) => {
      const row = {} as AdmissionRow
      for (const f of ADMISSION_ROW_FIELDS) {
        const i = mapping[f] ? index[mapping[f]] : undefined
        row[f] = i === undefined ? "" : (cells[i] ?? "").trim()
      }
      if (!row.class_name) row.class_name = defaultClass
      return row
    })
  }, [parsed, mapping, defaultClass])

  // Server row numbers count our list (header = 1); map them back to the file's rows.
  const errorsByIndex = React.useMemo(() => {
    const map = new Map<number, string[]>()
    for (const r of check?.rows ?? []) {
      if (!r.ok || r.errors.length) map.set(r.row - 2, r.errors.length ? r.errors : ["This row has a problem."])
    }
    return map
  }, [check])

  const missingRequired = mapping
    ? ADMISSION_ROW_FIELDS.filter((f) => FIELD_INFO[f].required && !mapping[f] && !(f === "class_name" && defaultClass))
    : []
  const classCellsEmpty =
    Boolean(parsed && mapping?.class_name) &&
    !defaultClass &&
    parsed!.rows.every(({ cells }) => !(cells[parsed!.headers.indexOf(mapping!.class_name)] ?? "").trim())
  const tooMany = rows.length > MAX_IMPORT_ROWS
  const mappedFields = mapping
    ? ADMISSION_ROW_FIELDS.filter((f) => mapping[f] || (f === "class_name" && defaultClass))
    : []

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      notify.error("Choose an Excel (.xlsx) or CSV file.")
      return
    }
    setReading(true)
    try {
      const matrix = await readMatrix(file)
      const headerIdx = matrix.findIndex((r) => r.some((c) => c.trim() !== ""))
      if (headerIdx < 0) {
        notify.error("The file is empty. Put the column names in the first row and one student per row below.")
        return
      }
      const seen = new Map<string, number>()
      const headers = matrix[headerIdx].map((h, i) => {
        const base = h.trim() || `Column ${i + 1}`
        const count = (seen.get(base) ?? 0) + 1
        seen.set(base, count)
        return count > 1 ? `${base} (${count})` : base
      })
      const dataRows = matrix
        .slice(headerIdx + 1)
        .map((cells, i) => ({ fileRow: headerIdx + i + 2, cells }))
        .filter((r) => r.cells.some((c) => c.trim() !== ""))
      if (dataRows.length === 0) {
        notify.error("The file has column names but no students. Add one student per row.")
        return
      }
      setParsed({ name: file.name, headers, rows: dataRows })
      setMapping(autoMap(headers))
      setCheck(null)
      setDone(null)
      setOnlyProblems(false)
      setDefaultClass("")
    } catch {
      notify.error("This file couldn't be read. Save it again as .xlsx or .csv and try once more.")
    } finally {
      setReading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const runCheck = async () => {
    try {
      const res = await importer.mutateAsync({ rows, dryRun: true })
      setCheck(res)
      if (res.valid) notify.success(`All ${rows.length} rows are ready to import.`)
      else {
        setOnlyProblems(true)
        notify.error("Some rows have problems. Fix them in the file, upload it again, and check again.")
      }
    } catch (error) {
      notify.error(`${errorMessage(error, "The rows couldn't be checked.")} Try again.`)
    }
  }

  const runImport = async () => {
    try {
      const res = await importer.mutateAsync({ rows, dryRun: false })
      if (res.valid && res.created > 0) {
        setDone(res)
      } else {
        setCheck(res)
        setOnlyProblems(true)
        notify.error("Nothing was imported: some rows have problems. Fix them and check again.")
      }
    } catch (error) {
      notify.error(`${errorMessage(error, "The import didn't finish.")} Nothing was saved; try again.`)
    }
  }

  const reset = () => {
    setParsed(null)
    setMapping(null)
    setCheck(null)
    setDone(null)
    setDefaultClass("")
  }

  const back = (
    <Link href={`/${school}/students`} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
      ← Students
    </Link>
  )

  if (done) {
    return (
      <PageShell
        eyebrow={back}
        title={`${done.created} ${done.created === 1 ? "student" : "students"} imported`}
        description="These passwords are shown only once. Download or print them now and hand them over. Everyone chooses a new password the first time they sign in."
        primaryAction={
          <Button asChild className="min-h-11 md:min-h-9">
            <Link href={`/${school}/students`}>Open students</Link>
          </Button>
        }
        secondaryActions={
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={reset}>
            Import another file
          </Button>
        }
      >
        {done.credentials.length > 0 ? (
          <>
            <CredentialsActions
              title="Sign-in details"
              credentials={done.credentials}
              csvFilename={`sign-in-details-${new Date().toISOString().slice(0, 10)}.csv`}
            />
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm" aria-label="Sign-in details">
                <thead className="bg-muted/40 text-left text-muted-foreground">
                  <tr className="border-b">
                    <th scope="col" className="h-11 px-4 font-medium">Name</th>
                    <th scope="col" className="h-11 px-4 font-medium">Account</th>
                    <th scope="col" className="h-11 px-4 font-medium">Username</th>
                    <th scope="col" className="h-11 px-4 font-medium">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {done.credentials.map((c, i) => (
                    <tr key={`${c.username}-${i}`} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 capitalize">{c.who}</td>
                      <td className="px-4 py-3 font-mono">{c.username}</td>
                      <td className="px-4 py-3 font-mono">{c.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState icon={CheckCircle2} description="No new accounts needed passwords." />
        )}
      </PageShell>
    )
  }

  const visible = parsed
    ? parsed.rows.map((r, i) => ({ ...r, index: i })).filter((r) => !onlyProblems || errorsByIndex.has(r.index))
    : []

  return (
    <PageShell
      eyebrow={back}
      title="Import students"
      description="Admit many students at once from a spreadsheet: one student per row, with their class and guardian. Nothing is saved until every row is correct."
      secondaryActions={
        <Button variant="outline" className="min-h-11 md:min-h-9" onClick={downloadTemplate}>
          <Download aria-hidden="true" />
          Download template
        </Button>
      }
    >
      <Step n={1} title="Choose the file" done={Boolean(parsed)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            id="import-file"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button asChild variant={parsed ? "outline" : "default"} className="min-h-11 md:min-h-9">
            <label htmlFor="import-file" className="cursor-pointer">
              {reading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              {parsed ? "Choose another file" : "Choose a spreadsheet"}
            </label>
          </Button>
          {parsed ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              <span className="break-all">{parsed.name}</span> · {parsed.rows.length}{" "}
              {parsed.rows.length === 1 ? "row" : "rows"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Excel (.xlsx) or CSV. Put column names in the first row. Classes must exist this year, e.g. &quot;Grade 1 - A&quot;.
            </p>
          )}
        </div>
        {tooMany ? (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            This file has {rows.length} rows. Import at most {MAX_IMPORT_ROWS} at a time: split it into smaller files.
          </p>
        ) : null}
      </Step>

      {parsed && mapping ? (
        <Step n={2} title="Match the columns" done={missingRequired.length === 0}>
          <p className="mb-4 text-sm text-muted-foreground">
            We matched the columns we recognised. Check each one; choose &quot;Not in the file&quot; for anything you don&apos;t have.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADMISSION_ROW_FIELDS.map((f) => {
              const id = `map-${f}`
              const missing = FIELD_INFO[f].required && !mapping[f]
              return (
                <div key={f} className="grid gap-2">
                  <label htmlFor={id} className={cn("text-sm font-medium", missing && "text-destructive")}>
                    {FIELD_INFO[f].label}
                    {FIELD_INFO[f].required ? (
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    ) : null}
                  </label>
                  <select
                    id={id}
                    className={selectClass}
                    aria-invalid={missing || undefined}
                    value={mapping[f]}
                    onChange={(e) => {
                      setMapping({ ...mapping, [f]: e.target.value })
                      setCheck(null)
                    }}
                  >
                    <option value="">Not in the file</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
          <div className="mt-4 grid gap-2 border-t pt-4 sm:max-w-sm">
            <label htmlFor="map-default-class" className="text-sm font-medium">
              Class for rows without one
            </label>
            <select
              id="map-default-class"
              className={selectClass}
              value={defaultClass}
              onChange={(e) => {
                setDefaultClass(e.target.value)
                setCheck(null)
              }}
            >
              <option value="">None: every row names its class</option>
              {namedClasses.map((c) => (
                <option key={c.id} value={c.name!}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">
              If the whole file is one class, choose it here instead of filling in a class column.
            </p>
          </div>
          {classCellsEmpty ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              The class column &quot;{mapping.class_name}&quot; is empty in every row. Choose the class for these
              students above, or fill in the column and upload the file again.
            </p>
          ) : null}
          {missingRequired.length > 0 ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              Choose the column for {missingRequired.map((f) => FIELD_INFO[f].label.toLowerCase()).join(", ")}.
            </p>
          ) : null}
        </Step>
      ) : null}

      {parsed && mapping ? (
        <Step n={3} title="Check and import" done={Boolean(check?.valid)}>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center [&>button]:min-h-11 md:[&>button]:min-h-9">
            <Button
              type="button"
              variant={check?.valid ? "outline" : "default"}
              onClick={runCheck}
              disabled={importer.isPending || missingRequired.length > 0 || tooMany}
            >
              {importer.isPending && importer.variables?.dryRun ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              Check rows
            </Button>
            <Button
              type="button"
              onClick={runImport}
              disabled={importer.isPending || !check?.valid || missingRequired.length > 0 || tooMany}
            >
              {importer.isPending && importer.variables && !importer.variables.dryRun ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              Import {rows.length} {rows.length === 1 ? "student" : "students"}
            </Button>
            {check ? (
              check.valid ? (
                <StatusBadge status="success" label="All rows are ready" size="md" />
              ) : (
                <StatusBadge
                  status="danger"
                  label={`${errorsByIndex.size} ${errorsByIndex.size === 1 ? "row needs" : "rows need"} fixing`}
                  size="md"
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">Check the rows first; nothing is saved by checking.</p>
            )}
          </div>

          {check && !check.valid ? (
            <label className="mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={onlyProblems}
                onChange={(e) => setOnlyProblems(e.target.checked)}
              />
              Show only rows with problems
            </label>
          ) : null}

          <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border">
            <table className="w-full text-sm" aria-label="Rows to import">
              <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="h-11 px-3 font-medium whitespace-nowrap">Row</th>
                  {mappedFields.map((f) => (
                    <th key={f} scope="col" className="h-11 px-3 font-medium whitespace-nowrap">
                      {FIELD_INFO[f].label}
                    </th>
                  ))}
                  {check ? (
                    <th scope="col" className="h-11 px-3 font-medium whitespace-nowrap">Problems</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const errs = errorsByIndex.get(r.index)
                  const row = rows[r.index]
                  return (
                    <tr key={r.fileRow} className={cn("border-b align-top last:border-0", errs && "bg-red-50")}>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{r.fileRow}</td>
                      {mappedFields.map((f) => (
                        <td key={f} className="px-3 py-2 whitespace-nowrap">
                          {row?.[f]}
                        </td>
                      ))}
                      {check ? (
                        <td className="min-w-64 px-3 py-2">
                          {errs ? (
                            <ul className="flex flex-col gap-1 text-red-800">
                              {errs.map((e, i) => (
                                <li key={i} className="flex gap-1">
                                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                  <span>{e}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-green-800">Ready</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Step>
      ) : null}
    </PageShell>
  )
}
