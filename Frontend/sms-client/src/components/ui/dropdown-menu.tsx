"use client"

// DropdownMenu: a trigger plus a list of actions or links (row actions, user menu, "More").
// Built on Headless UI v2 Menu because @radix-ui/react-dropdown-menu is not installed.
// Keyboard: Enter/Space/ArrowDown opens, arrows move, typeahead, Esc closes, focus returns to the trigger.
// The items-array API can be kept when swapping the internals to Radix later.

import * as React from "react"
import Link from "next/link"
import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from "@headlessui/react"
import { MoreHorizontal, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface DropdownMenuAction {
  label: string
  icon?: LucideIcon
  /** Called when the item is chosen. Use either onSelect or href. */
  onSelect?: () => void
  href?: string
  destructive?: boolean
  disabled?: boolean
}

export type DropdownMenuEntry = DropdownMenuAction | "separator"

export interface DropdownMenuProps {
  items: DropdownMenuEntry[]
  /**
   * The trigger element (e.g. <Button variant="outline">Actions</Button>). It must accept a ref and
   * spread props. If omitted, a 44px "more" icon button is rendered, labelled by `label`.
   */
  trigger?: React.ReactElement
  /** Accessible name for the default trigger, e.g. "Actions for Jane Doe". */
  label?: string
  align?: "start" | "end"
  className?: string
}

const itemClass =
  "group flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[focus]:bg-accent data-[focus]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0"

function DropdownMenu({ items, trigger, label = "More actions", align = "end", className }: DropdownMenuProps) {
  return (
    <Menu>
      {trigger ? (
        <MenuButton as={React.Fragment}>{trigger}</MenuButton>
      ) : (
        <MenuButton
          aria-label={label}
          className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[open]:bg-accent"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </MenuButton>
      )}
      <MenuItems
        transition
        anchor={align === "end" ? "bottom end" : "bottom start"}
        className={cn(
          "z-50 min-w-48 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none [--anchor-gap:4px]",
          "origin-top transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0",
          className
        )}
      >
        {items.map((entry, index) => {
          if (entry === "separator") {
            return <MenuSeparator key={`sep-${index}`} className="my-1 h-px bg-border" />
          }
          const Icon = entry.icon
          const content = (
            <>
              {Icon ? <Icon aria-hidden="true" /> : null}
              <span className="truncate">{entry.label}</span>
            </>
          )
          const tone = entry.destructive
            ? "text-destructive data-[focus]:bg-destructive/10 data-[focus]:text-destructive"
            : undefined
          return (
            <MenuItem key={`${entry.label}-${index}`} disabled={entry.disabled}>
              {entry.href && !entry.disabled ? (
                <Link href={entry.href} className={cn(itemClass, tone)} onClick={entry.onSelect}>
                  {content}
                </Link>
              ) : (
                <button type="button" className={cn(itemClass, tone)} onClick={entry.onSelect}>
                  {content}
                </button>
              )}
            </MenuItem>
          )
        })}
      </MenuItems>
    </Menu>
  )
}

export { DropdownMenu }
