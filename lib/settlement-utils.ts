/**
 * Utilidades de liquidación de pagos.
 * Calcula la liquidación neta para un cuidador en un período,
 * considerando horas trabajadas, gastos extra, dinero recibido y anticipos.
 *
 * Fórmula: (horas × tarifa) + gastos_extra − dinero_recibido − anticipos
 */

// ── Interfaces ──────────────────────────────────────────────

/** Entrada de tiempo con al menos las horas trabajadas. */
export interface SettlementEntry {
  hours: number
}

/** Anticipo de pago con al menos el monto. */
export interface SettlementAdvance {
  amount: number
}

/** Gasto extra o dinero recibido durante un turno. */
export interface SettlementExpense {
  type: "expense" | "income"
  amount: number
}

/** Resultado del cálculo de liquidación. */
export interface SettlementResult {
  grossPay: number       // horas × tarifa
  totalExpenses: number  // suma de gastos extra (type === "expense")
  totalIncome: number    // suma de dinero recibido (type === "income")
  totalAdvances: number  // suma de anticipos
  netPay: number         // grossPay + totalExpenses - totalIncome - totalAdvances
}

// ── Función principal ───────────────────────────────────────

/**
 * Calcula la liquidación completa para un cuidador en un período.
 *
 * @param entries   — Registros de tiempo con horas trabajadas
 * @param advances  — Anticipos de pago registrados
 * @param expenses  — Gastos extra y dinero recibido
 * @param hourlyRate — Tarifa por hora (COP)
 * @returns Desglose de la liquidación con pago neto
 */
export function calculateSettlement(
  entries: SettlementEntry[],
  advances: SettlementAdvance[],
  expenses: SettlementExpense[],
  hourlyRate: number,
): SettlementResult {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const grossPay = totalHours * hourlyRate

  const totalExpenses = expenses
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + e.amount, 0)

  const totalIncome = expenses
    .filter((e) => e.type === "income")
    .reduce((sum, e) => sum + e.amount, 0)

  const totalAdvances = advances.reduce((sum, a) => sum + a.amount, 0)

  const netPay = grossPay + totalExpenses - totalIncome - totalAdvances

  return {
    grossPay,
    totalExpenses,
    totalIncome,
    totalAdvances,
    netPay,
  }
}
