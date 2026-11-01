"use client"

// Find an existing guardian by name, username, email or phone (debounced combobox).

import * as React from "react"
import { Loader2, Search, UserRound, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/use-debounce"
import type { GuardianSearchResult } from "@/services/api/admissions-service"
import { errorMessage } from "./format"
import { useGuardianSearch } from "./queries"

export interface GuardianPickerProps {
  value: GuardianSearchResult | null
  onChange: (guardian: GuardianSearchResult | null) => void
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: true
}

function details(g: GuardianSearchResult): string {
  return [g.phone_number, g.username, g.email].filter(Boolean).join(" · ")
}

export function GuardianPicker({ value, onChange, id, ...aria }: GuardianPickerProps) {
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const debounced = useDebounce(query, 300)
  const search = useGuardianSearch(debounced)
  const listId = React.useId()
  const results = search.data ?? []
  const term = debounced.trim()

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/30 p-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserRound className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-medium break-words text-foreground">{value.name}</p>
            {details(value) ? <p className="text-sm break-all text-muted-foreground">{details(value)}</p> : null}
            {value.children?.length ? (
              <p className="text-sm text-muted-foreground">Guardian of {value.children.join(", ")}</p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 md:min-h-9"
          onClick={() => {
            onChange(null)
            setQuery("")
          }}
        >
          <X aria-hidden="true" />
          Change
        </Button>
      </div>
    )
  }

  const choose = (g: GuardianSearchResult) => {
    onChange(g)
    setOpen(false)
    setQuery("")
  }

  const showList = open && term.length >= 2

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        {...aria}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Type a name, phone number or username"
        className="h-11 pl-9"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList || results.length === 0) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => (a + 1) % results.length)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => (a - 1 + results.length) % results.length)
          } else if (e.key === "Enter") {
            e.preventDefault()
            choose(results[active])
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {showList ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          {search.isFetching && results.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Searching…
            </p>
          ) : search.isError ? (
            <p className="p-4 text-sm text-destructive">
              {errorMessage(search.error, "Search didn't work.")} Try again, or add a new guardian instead.
            </p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No guardian matches &quot;{term}&quot;. Check the spelling, or add a new guardian instead.
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Guardians" className="max-h-72 overflow-y-auto py-1">
              {results.map((g, i) => (
                <li
                  key={g.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(g)}
                  onMouseEnter={() => setActive(i)}
                  className={cn("min-h-11 cursor-pointer px-4 py-2", i === active && "bg-accent text-accent-foreground")}
                >
                  <p className="text-sm font-medium">{g.name}</p>
                  {details(g) ? <p className="text-xs break-all text-muted-foreground">{details(g)}</p> : null}
                  {g.children?.length ? (
                    <p className="text-xs text-muted-foreground">Guardian of {g.children.join(", ")}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
