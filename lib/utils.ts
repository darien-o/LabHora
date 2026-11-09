import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build an ISO 8601 (UTC) timestamp from a user-picked date ("YYYY-MM-DD")
 * and time ("HH:mm" or "HH:mm:ss"), treating them as the device's local time.
 *
 * This is intentionally timezone-agnostic on the client side: wherever the
 * device is, the wall-clock time the user typed is what gets submitted.
 * The PHP server converts the UTC value to Colombia time for display in the
 * sheet ("DD/MM/YYYY, HH:mm:ss"), so the stored format stays consistent
 * regardless of where the user is located.
 */
export function toLocalISO(dateStr: string, timeStr: string): string {
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  return new Date(`${dateStr}T${time}`).toISOString()
}

/**
 * @deprecated Renamed to toLocalISO. Kept as alias while callers are migrated.
 */
export const toColombiaISO = toLocalISO

/**
 * Parse a Google Sheets date string into a JavaScript Date.
 *
 * Handles both formats that exist in the sheet:
 *   - Canonical (app-written):  "DD/MM/YYYY, HH:mm:ss"
 *   - Legacy (manual entries):  "D/M/YYYY H:mm:ss"  (no comma, no zero-padding)
 *
 * The value is constructed as a local-time Date (same numbers the user sees),
 * which is correct for display, same-day comparisons, and filter logic.
 *
 * Returns null on any parse failure — callers must check before using the result.
 */
  export function parseSpanishDateTime(s: string | number): Date | null {
    if (s === null || s === undefined || s === "") return null
    try {
      // If Google Sheets returns a raw serial-date number (e.g. 46334.5)
      if (typeof s === "number" || (!isNaN(Number(s)) && !String(s).includes("/") && !String(s).includes("-"))) {
        const num = Number(s)
        const days = Math.floor(num)
        const fraction = num - days
        const msOfDay = Math.round(fraction * 86400 * 1000)
        const base = new Date(1899, 11, 30)
        base.setDate(base.getDate() + days)
        base.setMilliseconds(base.getMilliseconds() + msOfDay)
        return base
      }

      const str = String(s)
      // Strip the optional comma so both variants become "D/M/YYYY H:mm:ss"
      const normalized = str.replace(", ", " ").trim()
      const spaceIdx = normalized.indexOf(" ")
      if (spaceIdx === -1) return null
      const datePart = normalized.slice(0, spaceIdx)
      const timePart = normalized.slice(spaceIdx + 1)
      const [day, month, year] = datePart.split("/").map(Number)
      const [h, m, sec] = timePart.split(":").map(Number)
      if (!day || !month || !year || isNaN(h) || isNaN(m)) return null
      return new Date(year, month - 1, day, h, m, sec || 0)
    } catch {
      return null
    }
  }
