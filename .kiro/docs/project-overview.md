# Caregiver Time Clock Tracker

A Next.js web application for tracking caregiver work hours using Google Sheets as the database. The UI is entirely in Spanish (es-ES locale), targeting caregiving organizations in the GMT-5 timezone (Colombia/Ecuador).

## Tech Stack

- **Framework**: Next.js 14.2.16 (App Router, React 18, TypeScript)
- **UI**: shadcn/ui (50+ Radix UI components) + Tailwind CSS 3.4 + Lucide icons
- **Database**: Google Sheets API v4 (via `googleapis` package)
- **Fonts**: Geist Sans & Mono
- **Validation**: Zod + React Hook Form
- **Other**: date-fns, next-themes, recharts, sonner (toasts)

## Environment Variables

```
GOOGLE_SHEET_ID=<spreadsheet-id>
GOOGLE_CLIENT_EMAIL=<service-account-email>
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Google Sheets Structure

Three sheets (tabs) in a single spreadsheet:

### "Cuidadores" sheet
| Column A |
|----------|
| María García |
| Juan Pérez |
| (caregiver names, no header or header "nombre" is filtered out) |

### "Registro" sheet
| A (Fecha-Hora Entrada) | B (Fecha-Hora Salida) | C (Nombre) | D (Tiempo Total) | E (Pagado) |
|---|---|---|---|---|
| DD/MM/YYYY, HH:mm:ss | DD/MM/YYYY, HH:mm:ss | Caregiver Name | Hours (decimal) | Sí / No |

- All timestamps are stored in GMT-5 (America/Bogota) using `es-ES` locale format
- An active (clocked-in) entry has column B empty
- Total time is calculated as decimal hours (e.g., `8.50`)
- Column E tracks payment status ("Sí" = paid, "No" or empty = unpaid)

### "Turnos" sheet (shift scheduling)
| A (Fecha) | B (Nombre) | C (Hora Inicio) | D (Hora Fin) |
|---|---|---|---|
| 2026-03-23 | María García | 06:00 | 08:00 |

- Dates in YYYY-MM-DD format
- Times in HH:mm format (2-hour blocks from 06:00 to 22:00)

## Project Structure

```
app/
  layout.tsx          — Root layout (Geist fonts, metadata)
  page.tsx            — Main single-page app (ClockTracker component)
  globals.css         — Global styles + CSS variables for theming
  api/
    people/route.ts       — GET: Fetch caregivers + active status
    time-entries/route.ts — GET: Fetch all time entries
    clock-in/route.ts     — POST: Record clock-in
    clock-out/route.ts    — POST: Record clock-out
    historical-entry/route.ts — POST: Add backdated entry with conflict check

components/
  confirm-clock-out-dialog.tsx — Confirms long shifts (>8h), allows custom time
  historical-entry-dialog.tsx  — Creates backdated entries with conflict validation
  history-view.tsx             — Time entry history list with caregiver filter
  setup-guide.tsx              — Google Sheets API setup instructions (Spanish)
  theme-provider.tsx           — next-themes wrapper
  ui/                          — 50 shadcn/ui components

lib/
  google-sheets.ts    — All Google Sheets CRUD operations + business logic
  colombian-labor.ts  — Colombian labor law pay calculations (Ley 2466/2025)
  utils.ts            — cn() utility (clsx + tailwind-merge)

hooks/
  use-mobile.tsx      — Mobile detection hook
  use-toast.ts        — Toast notification hook
```

## API Endpoints

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/api/people` | GET | — | Returns caregivers with `isActive` flag and `lastClockIn` |
| `/api/time-entries` | GET | — | Returns all entries formatted for frontend |
| `/api/clock-in` | POST | `{personName, timestamp}` | Records clock-in; validates no duplicate/conflict |
| `/api/clock-out` | POST | `{personName, timestamp}` | Records clock-out; calculates total hours |
| `/api/toggle-paid` | POST | `{rowIndex, paid}` | Toggles paid/unpaid status in column E |
| `/api/historical-entry` | POST | `{personName, clockIn, clockOut}` | Adds backdated entry; checks time conflicts |

All responses use `Cache-Control: no-cache, no-store, must-revalidate` headers.

Success: `{success: true, message: "...", data: {...}}`
Error: `{error: "message"}` with HTTP 400 or 500.

## Core Business Logic (lib/google-sheets.ts)

### Exported Functions
| Function | Purpose |
|---|---|
| `getCuidadores()` | Reads "Cuidadores" sheet column A, filters blanks/header |
| `getTimeEntries()` | Reads "Registro" sheet, skips header, returns `TimeEntry[]` |
| `getActivePerson()` | Finds most recent entry without clock-out |
| `clockIn(personName, timestamp)` | Validates no active person conflict, appends row |
| `clockOut(personName, timestamp)` | Finds active entry, calculates hours, updates row |
| `addHistoricalEntry(personName, clockIn, clockOut)` | Validates conflicts, appends completed row |
| `checkTimeConflicts(personName, clockIn, clockOut)` | Checks overlap with existing entries for same person |
| `getConflictDetails(personName, clockIn, clockOut)` | Returns human-readable conflict description |
| `togglePaidStatus(rowIndex, paid)` | Updates column E ("Sí"/"No") for a specific row |

### Key Interfaces
```typescript
interface TimeEntry {
  id: string
  dateTimeIn: string
  dateTimeOut?: string
  personName: string
  totalTime?: number
}

interface Person {
  name: string
}
```

### Timezone Handling
- All timestamps are converted from UTC to GMT-5 before writing to sheets
- `convertToGMTMinus5()` and `formatDateTimeForSheet()` handle conversion
- `parseSpanishDateTime()` parses "DD/MM/YYYY, HH:mm:ss" back to Date objects
- This parser is duplicated in `history-view.tsx`, `time-entries/route.ts`, and `page.tsx`

## UI Flow

1. App loads → fetches `/api/people` and `/api/time-entries` in parallel
2. User selects a caregiver from a 2-column grid
3. Clock In:
   - If no one is active → POST `/api/clock-in`
   - If someone else is active → opens Historical Entry dialog
   - If same person already active → shows error
4. Clock Out:
   - If shift > 8 hours → opens Confirm Clock Out dialog (allows custom time)
   - Otherwise → POST `/api/clock-out` immediately
5. Historical Entry:
   - User picks clock-in/out date+time manually
   - Validates: no overlap, clock-out > clock-in, shift ≤ 24h, not in future
   - POST `/api/historical-entry`
6. History tab: shows all entries sorted by date, filterable by caregiver, with total hours

## Build Configuration (next.config.mjs)
- ESLint errors ignored during builds
- TypeScript errors ignored during builds
- Images unoptimized (for static/simple deployment)

## Scripts
```
npm run dev    — Start dev server
npm run build  — Production build
npm run start  — Start production server
npm run lint   — Run ESLint
```
