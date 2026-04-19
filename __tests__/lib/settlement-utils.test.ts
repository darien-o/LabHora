import { describe, it, expect } from "vitest"
import {
  calculateSettlement,
  type SettlementEntry,
  type SettlementAdvance,
  type SettlementExpense,
} from "@/lib/settlement-utils"

describe("calculateSettlement", () => {
  it("calculates gross pay from hours and hourly rate", () => {
    const entries: SettlementEntry[] = [{ hours: 8 }, { hours: 6 }]
    const result = calculateSettlement(entries, [], [], 10_000)

    expect(result.grossPay).toBe(140_000) // 14 hours × 10,000
    expect(result.totalExpenses).toBe(0)
    expect(result.totalIncome).toBe(0)
    expect(result.totalAdvances).toBe(0)
    expect(result.netPay).toBe(140_000)
  })

  it("adds expenses to the net pay", () => {
    const entries: SettlementEntry[] = [{ hours: 10 }]
    const expenses: SettlementExpense[] = [
      { type: "expense", amount: 15_000 },
      { type: "expense", amount: 5_000 },
    ]
    const result = calculateSettlement(entries, [], expenses, 10_000)

    expect(result.grossPay).toBe(100_000)
    expect(result.totalExpenses).toBe(20_000)
    expect(result.netPay).toBe(120_000) // 100,000 + 20,000
  })

  it("subtracts income from the net pay", () => {
    const entries: SettlementEntry[] = [{ hours: 10 }]
    const expenses: SettlementExpense[] = [
      { type: "income", amount: 30_000 },
    ]
    const result = calculateSettlement(entries, [], expenses, 10_000)

    expect(result.grossPay).toBe(100_000)
    expect(result.totalIncome).toBe(30_000)
    expect(result.netPay).toBe(70_000) // 100,000 - 30,000
  })

  it("subtracts advances from the net pay", () => {
    const entries: SettlementEntry[] = [{ hours: 20 }]
    const advances: SettlementAdvance[] = [
      { amount: 50_000 },
      { amount: 25_000 },
    ]
    const result = calculateSettlement(entries, advances, [], 10_000)

    expect(result.grossPay).toBe(200_000)
    expect(result.totalAdvances).toBe(75_000)
    expect(result.netPay).toBe(125_000) // 200,000 - 75,000
  })

  it("applies the full formula: grossPay + expenses - income - advances", () => {
    const entries: SettlementEntry[] = [{ hours: 8 }, { hours: 8 }]
    const advances: SettlementAdvance[] = [{ amount: 20_000 }]
    const expenses: SettlementExpense[] = [
      { type: "expense", amount: 10_000 },
      { type: "income", amount: 5_000 },
    ]
    const result = calculateSettlement(entries, advances, expenses, 9_000)

    expect(result.grossPay).toBe(144_000)   // 16h × 9,000
    expect(result.totalExpenses).toBe(10_000)
    expect(result.totalIncome).toBe(5_000)
    expect(result.totalAdvances).toBe(20_000)
    expect(result.netPay).toBe(129_000)     // 144,000 + 10,000 - 5,000 - 20,000
  })

  it("returns all zeros for empty inputs", () => {
    const result = calculateSettlement([], [], [], 10_000)

    expect(result.grossPay).toBe(0)
    expect(result.totalExpenses).toBe(0)
    expect(result.totalIncome).toBe(0)
    expect(result.totalAdvances).toBe(0)
    expect(result.netPay).toBe(0)
  })

  it("handles zero hourly rate", () => {
    const entries: SettlementEntry[] = [{ hours: 10 }]
    const expenses: SettlementExpense[] = [{ type: "expense", amount: 5_000 }]
    const result = calculateSettlement(entries, [], expenses, 0)

    expect(result.grossPay).toBe(0)
    expect(result.totalExpenses).toBe(5_000)
    expect(result.netPay).toBe(5_000) // 0 + 5,000
  })

  it("can produce a negative net pay when deductions exceed earnings", () => {
    const entries: SettlementEntry[] = [{ hours: 2 }]
    const advances: SettlementAdvance[] = [{ amount: 100_000 }]
    const result = calculateSettlement(entries, advances, [], 10_000)

    expect(result.grossPay).toBe(20_000)
    expect(result.totalAdvances).toBe(100_000)
    expect(result.netPay).toBe(-80_000) // 20,000 - 100,000
  })
})
