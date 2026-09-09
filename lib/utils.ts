import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build an ISO 8601 timestamp from a date string ("YYYY-MM-DD") and a time
 * string ("HH:mm" or "HH:mm:ss") interpreted as Colombia time
 * (America/Bogota, UTC-5), regardless of the device's local timezone.
 *
 * Always use this instead of `new Date(`${date}T${time}`).toISOString()`
 * when the user has manually picked a date and time.
 */
export function toColombiaISO(dateStr: string, timeStr: string): string {
  // Append seconds if not present so the Date constructor is unambiguous
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  // Colombia is UTC-5 year-round (no daylight saving time)
  return new Date(`${dateStr}T${time}-05:00`).toISOString()
}

/**
 * Parse a date string from Google Sheets into a JavaScript Date (local time).
 *
 * Handles both formats stored in the sheet:
 *   - New (app-written):  "DD/MM/YYYY, HH:mm:ss"  (comma + space separator)
 *   - Legacy (manual):    "D/M/YYYY H:mm:ss"       (space only, no zero-padding)
 *
 * Returns null on parse failure so callers can handle it explicitly.
 */
export function parseSpanishDateTime(s: string): Date | null {
  if (!s || typeof s !== "string") return null
  try {
    // Normalize: remove the optional comma so both formats become "D/M/YYYY H:mm:ss"
    const normalized = s.replace(", ", " ").trim()
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
