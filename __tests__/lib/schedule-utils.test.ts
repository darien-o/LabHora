import { describe, it, expect } from "vitest"
import {
  generateMultiDayRecords,
  generateRepeatInstances,
  checkBlockConflicts,
  getWeekStartMonday,
  getNextCalendarDay,
  type MultiDayConfig,
  type ScheduleBlock,
} from "@/lib/schedule-utils"

// ── generateMultiDayRecords ─────────────────────────────────

describe("generateMultiDayRecords", () => {
  it("returns one record for a single-day range", () => {
    const config: MultiDayConfig = {
      startDate: "2025-01-15",
      endDate: "2025-01-15",
      startTime: "08:00",
      endTime: "17:00",
    }
    const records = generateMultiDayRecords(config)
    expect(records).toHaveLength(1)
    expect(records[0]).toEqual({ date: "2025-01-15", startTime: "08:00", endTime: "17:00" })
  })

  it("generates correct records for a 2-day range", () => {
    const config: MultiDayConfig = {
      startDate: "2025-01-15",
      endDate: "2025-01-16",
      startTime: "14:00",
      endTime: "10:00",
    }
    const records = generateMultiDayRecords(config)
    expect(records).toHaveLength(2)
    expect(records[0]).toEqual({ date: "2025-01-15", startTime: "14:00", endTime: "23:59" })
    expect(records[1]).toEqual({ date: "2025-01-16", startTime: "00:00", endTime: "10:00" })
  })

  it("generates correct records for a 4-day range with intermediates", () => {
    const config: MultiDayConfig = {
      startDate: "2025-03-10",
      endDate: "2025-03-13",
      startTime: "20:00",
      endTime: "06:00",
    }
    const records = generateMultiDayRecords(config)
    expect(records).toHaveLength(4)
    expect(records[0]).toEqual({ date: "2025-03-10", startTime: "20:00", endTime: "23:59" })
    expect(records[1]).toEqual({ date: "2025-03-11", startTime: "00:00", endTime: "23:59" })
    expect(records[2]).toEqual({ date: "2025-03-12", startTime: "00:00", endTime: "23:59" })
    expect(records[3]).toEqual({ date: "2025-03-13", startTime: "00:00", endTime: "06:00" })
  })

  it("returns empty array when endDate is before startDate", () => {
    const config: MultiDayConfig = {
      startDate: "2025-01-20",
      endDate: "2025-01-15",
      startTime: "08:00",
      endTime: "17:00",
    }
    expect(generateMultiDayRecords(config)).toEqual([])
  })

  it("handles month boundary correctly", () => {
    const config: MultiDayConfig = {
      startDate: "2025-01-31",
      endDate: "2025-02-02",
      startTime: "22:00",
      endTime: "08:00",
    }
    const records = generateMultiDayRecords(config)
    expect(records).toHaveLength(3)
    expect(records[0].date).toBe("2025-01-31")
    expect(records[1].date).toBe("2025-02-01")
    expect(records[2].date).toBe("2025-02-02")
  })
})

// ── generateRepeatInstances ─────────────────────────────────

describe("generateRepeatInstances", () => {
  it("generates daily instances for a 5-day range", () => {
    const instances = generateRepeatInstances("2025-01-06", "2025-01-10", "daily", "09:00", "17:00")
    expect(instances).toHaveLength(5)
    expect(instances[0].date).toBe("2025-01-06")
    expect(instances[4].date).toBe("2025-01-10")
    instances.forEach((inst) => {
      expect(inst.startTime).toBe("09:00")
      expect(inst.endTime).toBe("17:00")
    })
  })

  it("generates weekly instances for a 4-week range", () => {
    // 2025-01-06 is a Monday
    const instances = generateRepeatInstances("2025-01-06", "2025-01-27", "weekly", "08:00", "16:00")
    expect(instances).toHaveLength(4)
    expect(instances[0].date).toBe("2025-01-06")
    expect(instances[1].date).toBe("2025-01-13")
    expect(instances[2].date).toBe("2025-01-20")
    expect(instances[3].date).toBe("2025-01-27")
  })

  it("generates one instance when start equals end for daily", () => {
    const instances = generateRepeatInstances("2025-06-15", "2025-06-15", "daily", "10:00", "14:00")
    expect(instances).toHaveLength(1)
    expect(instances[0]).toEqual({ date: "2025-06-15", startTime: "10:00", endTime: "14:00" })
  })

  it("generates one instance when range is less than a week for weekly", () => {
    const instances = generateRepeatInstances("2025-01-06", "2025-01-10", "weekly", "08:00", "16:00")
    expect(instances).toHaveLength(1)
    expect(instances[0].date).toBe("2025-01-06")
  })

  it("returns empty array when endDate is before startDate", () => {
    expect(generateRepeatInstances("2025-01-20", "2025-01-10", "daily", "08:00", "16:00")).toEqual([])
  })
})

// ── checkBlockConflicts ─────────────────────────────────────

describe("checkBlockConflicts", () => {
  const blocks: ScheduleBlock[] = [
    {
      rowIndex: 1,
      personName: "Ana",
      startDate: "2025-01-15",
      endDate: "2025-01-17",
    },
    {
      rowIndex: 2,
      personName: "Carlos",
      startDate: "2025-01-20",
      endDate: "2025-01-20",
      startTime: "08:00",
      endTime: "12:00",
    },
  ]

  it("returns the block when a full-day block conflicts", () => {
    const result = checkBlockConflicts("Ana", "2025-01-16", "09:00", "17:00", blocks)
    expect(result).not.toBeNull()
    expect(result!.rowIndex).toBe(1)
  })

  it("returns null when the person has no block on that date", () => {
    const result = checkBlockConflicts("Ana", "2025-01-20", "09:00", "17:00", blocks)
    expect(result).toBeNull()
  })

  it("returns null for a different person", () => {
    const result = checkBlockConflicts("Carlos", "2025-01-16", "09:00", "17:00", blocks)
    expect(result).toBeNull()
  })

  it("detects time-range overlap within a partial block", () => {
    const result = checkBlockConflicts("Carlos", "2025-01-20", "10:00", "14:00", blocks)
    expect(result).not.toBeNull()
    expect(result!.rowIndex).toBe(2)
  })

  it("returns null when shift is outside the blocked time range", () => {
    const result = checkBlockConflicts("Carlos", "2025-01-20", "13:00", "17:00", blocks)
    expect(result).toBeNull()
  })

  it("returns null when no blocks exist", () => {
    const result = checkBlockConflicts("Ana", "2025-01-16", "09:00", "17:00", [])
    expect(result).toBeNull()
  })

  it("detects conflict with weekly repeating block", () => {
    const weeklyBlocks: ScheduleBlock[] = [
      {
        rowIndex: 3,
        personName: "Ana",
        startDate: "2025-01-06", // Monday
        endDate: "2025-01-06",
        repeat: "weekly",
        repeatEndDate: "2025-02-03",
      },
    ]
    // Should conflict on the next Monday (Jan 13)
    const result = checkBlockConflicts("Ana", "2025-01-13", "09:00", "17:00", weeklyBlocks)
    expect(result).not.toBeNull()
    expect(result!.rowIndex).toBe(3)
  })

  it("does not conflict with weekly block on a different day of week", () => {
    const weeklyBlocks: ScheduleBlock[] = [
      {
        rowIndex: 3,
        personName: "Ana",
        startDate: "2025-01-06", // Monday
        endDate: "2025-01-06",
        repeat: "weekly",
        repeatEndDate: "2025-02-03",
      },
    ]
    // Tuesday should not conflict
    const result = checkBlockConflicts("Ana", "2025-01-14", "09:00", "17:00", weeklyBlocks)
    expect(result).toBeNull()
  })
})

// ── getWeekStartMonday ──────────────────────────────────────

describe("getWeekStartMonday", () => {
  it("returns Monday for a Monday input", () => {
    const monday = new Date(2025, 0, 6) // Jan 6, 2025 = Monday
    const result = getWeekStartMonday(monday)
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getDate()).toBe(6)
  })

  it("returns Monday for a Wednesday input", () => {
    const wednesday = new Date(2025, 0, 8) // Jan 8, 2025 = Wednesday
    const result = getWeekStartMonday(wednesday)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(6)
  })

  it("returns Monday for a Sunday input", () => {
    const sunday = new Date(2025, 0, 12) // Jan 12, 2025 = Sunday
    const result = getWeekStartMonday(sunday)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(6)
  })

  it("returns Monday for a Saturday input", () => {
    const saturday = new Date(2025, 0, 11) // Jan 11, 2025 = Saturday
    const result = getWeekStartMonday(saturday)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(6)
  })

  it("sets time to midnight", () => {
    const date = new Date(2025, 0, 8, 15, 30, 45)
    const result = getWeekStartMonday(date)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it("does not mutate the input date", () => {
    const original = new Date(2025, 0, 8, 15, 30)
    const originalTime = original.getTime()
    getWeekStartMonday(original)
    expect(original.getTime()).toBe(originalTime)
  })
})

// ── getNextCalendarDay ──────────────────────────────────────

describe("getNextCalendarDay", () => {
  it("returns the next day for a regular weekday", () => {
    expect(getNextCalendarDay("2025-01-08")).toBe("2025-01-09") // Wed → Thu
  })

  it("returns Saturday after Friday (does not skip weekends)", () => {
    expect(getNextCalendarDay("2025-01-10")).toBe("2025-01-11") // Fri → Sat
  })

  it("returns Sunday after Saturday", () => {
    expect(getNextCalendarDay("2025-01-11")).toBe("2025-01-12") // Sat → Sun
  })

  it("returns Monday after Sunday", () => {
    expect(getNextCalendarDay("2025-01-12")).toBe("2025-01-13") // Sun → Mon
  })

  it("handles month boundary", () => {
    expect(getNextCalendarDay("2025-01-31")).toBe("2025-02-01")
  })

  it("handles year boundary", () => {
    expect(getNextCalendarDay("2025-12-31")).toBe("2026-01-01")
  })

  it("handles leap year Feb 28", () => {
    expect(getNextCalendarDay("2024-02-28")).toBe("2024-02-29")
  })

  it("handles non-leap year Feb 28", () => {
    expect(getNextCalendarDay("2025-02-28")).toBe("2025-03-01")
  })
})
