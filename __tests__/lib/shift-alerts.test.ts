import { describe, it, expect } from "vitest"
import {
  shouldShowUpcomingAlert,
  shouldGenerateNoShowAlert,
} from "@/lib/shift-alerts"

// ── shouldShowUpcomingAlert ─────────────────────────────────

describe("shouldShowUpcomingAlert", () => {
  it("returns true when shift is exactly 30 minutes away", () => {
    const current = new Date(2025, 0, 15, 8, 30, 0) // 08:30
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(true)
  })

  it("returns true when shift is 15 minutes away", () => {
    const current = new Date(2025, 0, 15, 8, 45, 0) // 08:45
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(true)
  })

  it("returns true when shift is 1 minute away", () => {
    const current = new Date(2025, 0, 15, 8, 59, 0) // 08:59
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(true)
  })

  it("returns false when shift already started (exactly at start time)", () => {
    const current = new Date(2025, 0, 15, 9, 0, 0) // 09:00
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(false)
  })

  it("returns false when shift started 10 minutes ago", () => {
    const current = new Date(2025, 0, 15, 9, 10, 0) // 09:10
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(false)
  })

  it("returns false when shift is more than 30 minutes away", () => {
    const current = new Date(2025, 0, 15, 8, 0, 0) // 08:00 — 60 min away
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(false)
  })

  it("returns false when shift is 31 minutes away", () => {
    const current = new Date(2025, 0, 15, 8, 29, 0) // 08:29
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(false)
  })

  it("handles midnight shift correctly", () => {
    const current = new Date(2025, 0, 15, 23, 45, 0) // 23:45
    expect(shouldShowUpcomingAlert("2025-01-16", "00:00", current)).toBe(true)
  })

  it("returns false when shift is on a different day far in the future", () => {
    const current = new Date(2025, 0, 14, 9, 0, 0) // day before
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(false)
  })

  it("handles seconds precision — just under 30 minutes returns true", () => {
    // 29 minutes and 59 seconds before 09:00 → 08:30:01
    const current = new Date(2025, 0, 15, 8, 30, 1)
    expect(shouldShowUpcomingAlert("2025-01-15", "09:00", current)).toBe(true)
  })
})

// ── shouldGenerateNoShowAlert ───────────────────────────────

describe("shouldGenerateNoShowAlert", () => {
  it("returns true when 61 minutes have passed and not confirmed", () => {
    const current = new Date(2025, 0, 15, 10, 1, 0) // 10:01, shift at 09:00
    expect(shouldGenerateNoShowAlert("2025-01-15", "09:00", current, false)).toBe(true)
  })

  it("returns true when 120 minutes have passed and not confirmed", () => {
    const current = new Date(2025, 0, 15, 11, 0, 0) // 11:00
    expect(shouldGenerateNoShowAlert("2025-01-15", "09:00", current, false)).toBe(true)
  })

  it("returns false when exactly 60 minutes have passed (not >60)", () => {
    const current = new Date(2025, 0, 15, 10, 0, 0) // 10:00
    expect(shouldGenerateNoShowAlert("2025-01-15", "09:00", current, false)).toBe(false)
  })

  it("returns false when confirmed even if >60 minutes passed", () => {
    const current = new Date(2025, 0, 15, 11, 0, 0) // 11:00
    expect(shouldGenerateNoShowAlert("2025-01-15", "09:00", current, true)).toBe(false)
  })

  it("returns false when shift has not started yet", () => {
    const current = new Date(2025, 0, 15, 8, 0, 0) // 08:00
    expect(shouldGenerateNoShowAlert("2025-01-15", "09:00", current, false)).toBe(false)
  })

  it("returns false when only 30 minutes have passed", () => {
    const current = new Date(2025, 0, 15, 9, 30, 0) // 09:30
    expect(shouldGenerateNoShowAlert("2025-01-15", "09:00", current, false)).toBe(false)
  })

  it("returns false when confirmed is true regardless of time", () => {
    const current = new Date(2025, 0, 15, 12, 0, 0) // 3 hours later
    expect(shouldGenerateNoShowAlert("2025-01-15", "09:00", current, true)).toBe(false)
  })

  it("handles midnight shift correctly", () => {
    const current = new Date(2025, 0, 16, 1, 1, 0) // 01:01, shift at 00:00
    expect(shouldGenerateNoShowAlert("2025-01-16", "00:00", current, false)).toBe(true)
  })

  it("returns false at exactly shift start time", () => {
    const current = new Date(2025, 0, 15, 9, 0, 0) // 09:00
    expect(shouldGenerateNoShowAlert("2025-01-15", "09:00", current, false)).toBe(false)
  })
})
