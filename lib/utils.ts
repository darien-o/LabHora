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
