# Design brief

## 1. Goal

Make the app feel like one calm, predictable tool that office staff can learn in an afternoon and that parents can use on a cheap phone without help. The current UI mixes several styles, page layouts and component libraries; the remodel standardises them.

## 2. Principles

1. **Task first.** Each page answers one question or does one job. The primary action is obvious and in the same place on every page.
2. **Show the next step.** After saving, offer what usually comes next ("Enroll students in this class"). Never leave the user at a dead end.
3. **Say what to do, not what failed.** Errors name the problem and the fix, in plain words.
4. **Phone first for teachers, parents and gate staff;** desk first for office work (setup, finance, reports), but nothing breaks on a phone.
5. **Light on data.** Small pages, few images, no autoplay. A page should still be readable before all data loads.
6. **Familiar outputs.** Report cards, receipts and ID cards look like the paper versions schools already use.

## 3. Audience notes

- **Parents** may have low literacy and share a phone. Use short words, large touch targets, icons with labels, colour plus text for status (never colour alone), and numbers people know (dates as "Mon 20 Oct").
- **Office staff** work in long sessions with many records: tables with search, filters, bulk actions and keyboard use.
- **Teachers** mark attendance standing in a classroom: one-handed use, big status buttons, quick save.
- **Gate staff** need speed: a full-screen camera and an instant, unmistakable result.

## 4. Design system

| Concern | Standard | Replaces |
|---|---|---|
| Components | shadcn/ui on Radix: Button, Input, Select, Dialog, AlertDialog, Sheet, DropdownMenu, Tabs, Table, Badge, Card, Toast | Headless UI dialog, 16 hand-built modals, `window.confirm` (12 places) |
| Icons | lucide-react only | Mixed lucide and Heroicons |
| Toasts | sonner only | `use-toast` and `alert()` |
| Data | TanStack Query for reads and mutations, with query keys per school | 41 pages fetching in `useEffect` |
| Forms | react-hook-form with zod schemas shared with the API types | Ad-hoc state per form |
| Layout | One `PageShell` (title, description, primary action, tabs) and one `PageHeader` | Several container and heading styles per page |

### 4.1 Tokens

- **Colour:** neutral slate base; one brand primary per school (from the school's branding, with a contrast check), falling back to indigo. Status colours are fixed across the app and always paired with a label:
  - present: green
  - late: orange
  - absent: red
  - excused / sick: blue
  - pending: amber
- **Type:** system font stack (no web font download on phones). Sizes 12 / 14 / 16 / 20 / 24 / 30; body 16 on phones.
- **Spacing:** 4-point scale. Touch targets at least 44 × 44 px.
- **Radius and elevation:** one radius (8 px for inputs, 12 px for cards); shadows only for overlays.
- **Dark mode:** not in scope for the remodel; tokens are defined so it can be added.

## 5. Layout

- **Desk (≥ 1024 px):** left sidebar (7 items max) with the school's logo; top bar with school switcher (operators only), search, notifications and user menu.
- **Phone (< 768 px):** top bar with title and back; bottom navigation with up to 5 items plus "More". No horizontal scrolling of the page; wide tables become cards or scroll inside their container.
- **Scanner:** full screen, no navigation, large result banner, sound and vibration on result.
- **Print:** report cards, receipts, ID cards and class lists have print stylesheets (A4 and ID-1 card size), no app chrome.

## 6. Key screens to design first

1. Sign-in (school branded) and first-login password.
2. Admin home with setup checklist and today's numbers.
3. Year setup wizard (5 steps).
4. Student profile with tabs.
5. Teacher home and attendance roster (phone).
6. Gradebook grid (desk) and mark entry (phone).
7. Parent home with child switcher (phone).
8. Record payment and printed receipt.
9. Report card (print).
10. Scan screen.

## 7. Content style

- Sentence case for titles and buttons ("Record payment", not "Record Payment").
- Buttons say what happens ("Publish results"), never "Submit" or "OK".
- Dates: "Mon 20 Oct 2026"; times in the school's time zone; money with its currency code ("USD 150.00").
- Confirm destructive actions with what will be lost ("Delete 3 students and their enrollments? This can't be undone.").

## 8. Accessibility

- Contrast at least 4.5:1 for text; labels on every input; visible focus rings.
- Status shown with text or icon as well as colour.
- All actions reachable by keyboard on desk layouts.

## 9. Deliverables

- Figma (or equivalent) with the tokens, the component set and the 10 key screens at phone and desk widths.
- A `components/ui` package in the frontend matching the design, with `PageShell`, `DataTable`, `StatusBadge`, `EmptyState`, `ConfirmDialog`, `FormField`.
- A short content guide (section 7) checked into the repo.
