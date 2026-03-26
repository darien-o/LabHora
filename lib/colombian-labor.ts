/**
 * Colombian Labor Law calculations (Ley 2466 de 2025 / Reforma Laboral)
 *
 * References:
 * - Salario mínimo 2026: COP $1,750,905/mes
 * - Auxilio de transporte: COP $249,095/mes
 * - Jornada: 44h/semana (hasta Jul 15 2026), 42h/semana (desde Jul 15 2026)
 * - Jornada nocturna: 7:00 PM – 6:00 AM (desde Dic 25, 2025)
 * - Recargo nocturno: +35%
 * - Hora extra diurna: +25%
 * - Hora extra nocturna: +75%
 * - Dominical/festivo: +80% (hasta Jul 2026), +90% (Jul 2026 – Jul 2027)
 * - Dominical/festivo nocturno: +110%
 *
 * Source: https://www.hivedesk.com/compliance/colombia/
 */

// --- Constants ---

const MONTHLY_MIN_WAGE = 1_750_905 // COP 2026
const TRANSPORT_ALLOWANCE = 249_095 // COP 2026

// Weekly hours depend on date (Ley 2101 de 2021 + Ley 2466 de 2025)
const WEEKLY_HOURS_BEFORE_JUL_2026 = 44
const WEEKLY_HOURS_AFTER_JUL_2026 = 42
const WEEKLY_HOURS_CUTOFF = new Date(2026, 6, 15) // Jul 15, 2026

// Night work: 7 PM to 6 AM
const NIGHT_START_HOUR = 19 // 7:00 PM
const NIGHT_END_HOUR = 6 // 6:00 AM

// Surcharge rates (as multipliers of the base hourly rate)
const SURCHARGES = {
  regular: 1.0,
  nightSurcharge: 1.35, // +35%
  overtimeDay: 1.25, // +25%
  overtimeNight: 1.75, // +75%
  sundayHolidayBeforeJul2026: 1.80, // +80%
  sundayHolidayAfterJul2026: 1.90, // +90%
  sundayHolidayNight: 2.10, // +110%
}

// Colombian public holidays 2026 (Ley Emiliani applied)
const HOLIDAYS_2026: string[] = [
  "2026-01-01", // Año Nuevo
  "2026-01-12", // Reyes Magos (Emiliani)
  "2026-03-23", // San José (Emiliani)
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-05-18", // Ascensión (Emiliani)
  "2026-06-08", // Corpus Christi (Emiliani)
  "2026-06-15", // Sagrado Corazón (Emiliani)
  "2026-06-29", // San Pedro y San Pablo (Emiliani)
  "2026-07-20", // Independencia
  "2026-08-07", // Batalla de Boyacá
  "2026-08-17", // Asunción (Emiliani)
  "2026-10-12", // Día de la Raza (Emiliani)
  "2026-11-02", // Todos los Santos (Emiliani)
  "2026-11-16", // Independencia de Cartagena (Emiliani)
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
]

// --- Helpers ---

function getWeeklyHours(date: Date): number {
  return date >= WEEKLY_HOURS_CUTOFF
    ? WEEKLY_HOURS_AFTER_JUL_2026
    : WEEKLY_HOURS_BEFORE_JUL_2026
}

function getHourlyRate(date: Date): number {
  const weeklyHours = getWeeklyHours(date)
  const monthlyHours = (weeklyHours * 52) / 12 // ~190.67 or ~182
  return MONTHLY_MIN_WAGE / monthlyHours
}

function isHoliday(date: Date): boolean {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  return HOLIDAYS_2026.includes(dateStr)
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

function isSundayOrHoliday(date: Date): boolean {
  return isSunday(date) || isHoliday(date)
}

function isNightHour(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
}

function getSundayHolidayRate(date: Date): number {
  return date >= WEEKLY_HOURS_CUTOFF
    ? SURCHARGES.sundayHolidayAfterJul2026
    : SURCHARGES.sundayHolidayBeforeJul2026
}

// --- Types ---

export interface HourBreakdown {
  regularDay: number // Horas ordinarias diurnas
  regularNight: number // Horas ordinarias nocturnas (recargo 35%)
  sundayHolidayDay: number // Horas dominicales/festivas diurnas
  sundayHolidayNight: number // Horas dominicales/festivas nocturnas
  totalHours: number
}

export interface PayBreakdown {
  hourlyRate: number
  regularDayPay: number
  regularNightPay: number
  sundayHolidayDayPay: number
  sundayHolidayNightPay: number
  totalPay: number
  breakdown: HourBreakdown
}

export interface PaySummary {
  totalHours: number
  hourBreakdown: HourBreakdown
  hourlyRate: number
  regularDayPay: number
  regularNightPay: number
  sundayHolidayDayPay: number
  sundayHolidayNightPay: number
  totalPay: number
  monthlyMinWage: number
  transportAllowance: number
}

// --- Core calculation ---

/**
 * Classifies each hour of a shift into the appropriate pay category.
 * Iterates minute-by-minute for accuracy across midnight/boundary crossings.
 */
export function classifyHours(clockIn: Date, clockOut: Date): HourBreakdown {
  const result: HourBreakdown = {
    regularDay: 0,
    regularNight: 0,
    sundayHolidayDay: 0,
    sundayHolidayNight: 0,
    totalHours: 0,
  }

  // Iterate in 1-minute increments
  const startMs = clockIn.getTime()
  const endMs = clockOut.getTime()
  const minuteMs = 60_000

  for (let ms = startMs; ms < endMs; ms += minuteMs) {
    const current = new Date(ms)
    const hour = current.getHours()
    const night = isNightHour(hour)
    const sundayOrHoliday = isSundayOrHoliday(current)

    const fraction = 1 / 60 // 1 minute = 1/60 hour

    if (sundayOrHoliday && night) {
      result.sundayHolidayNight += fraction
    } else if (sundayOrHoliday) {
      result.sundayHolidayDay += fraction
    } else if (night) {
      result.regularNight += fraction
    } else {
      result.regularDay += fraction
    }
  }

  // Round to 2 decimals
  result.regularDay = Math.round(result.regularDay * 100) / 100
  result.regularNight = Math.round(result.regularNight * 100) / 100
  result.sundayHolidayDay = Math.round(result.sundayHolidayDay * 100) / 100
  result.sundayHolidayNight = Math.round(result.sundayHolidayNight * 100) / 100
  result.totalHours =
    result.regularDay + result.regularNight + result.sundayHolidayDay + result.sundayHolidayNight

  return result
}

/**
 * Calculates pay for a single shift based on hour classification.
 */
export function calculateShiftPay(clockIn: Date, clockOut: Date): PayBreakdown {
  const breakdown = classifyHours(clockIn, clockOut)
  const rate = getHourlyRate(clockIn)
  const shRate = getSundayHolidayRate(clockIn)

  const regularDayPay = breakdown.regularDay * rate * SURCHARGES.regular
  const regularNightPay = breakdown.regularNight * rate * SURCHARGES.nightSurcharge
  const sundayHolidayDayPay = breakdown.sundayHolidayDay * rate * shRate
  const sundayHolidayNightPay = breakdown.sundayHolidayNight * rate * SURCHARGES.sundayHolidayNight

  return {
    hourlyRate: Math.round(rate),
    regularDayPay: Math.round(regularDayPay),
    regularNightPay: Math.round(regularNightPay),
    sundayHolidayDayPay: Math.round(sundayHolidayDayPay),
    sundayHolidayNightPay: Math.round(sundayHolidayNightPay),
    totalPay: Math.round(regularDayPay + regularNightPay + sundayHolidayDayPay + sundayHolidayNightPay),
    breakdown,
  }
}


/**
 * Calculates a pay summary across multiple shifts.
 */
export function calculatePaySummary(
  entries: Array<{ clockIn: Date; clockOut: Date }>
): PaySummary {
  const totals: PaySummary = {
    totalHours: 0,
    hourBreakdown: {
      regularDay: 0,
      regularNight: 0,
      sundayHolidayDay: 0,
      sundayHolidayNight: 0,
      totalHours: 0,
    },
    hourlyRate: 0,
    regularDayPay: 0,
    regularNightPay: 0,
    sundayHolidayDayPay: 0,
    sundayHolidayNightPay: 0,
    totalPay: 0,
    monthlyMinWage: MONTHLY_MIN_WAGE,
    transportAllowance: TRANSPORT_ALLOWANCE,
  }

  if (entries.length === 0) return totals

  // Use the first entry's date for hourly rate display
  totals.hourlyRate = getHourlyRate(entries[0].clockIn)

  for (const entry of entries) {
    const pay = calculateShiftPay(entry.clockIn, entry.clockOut)
    totals.hourBreakdown.regularDay += pay.breakdown.regularDay
    totals.hourBreakdown.regularNight += pay.breakdown.regularNight
    totals.hourBreakdown.sundayHolidayDay += pay.breakdown.sundayHolidayDay
    totals.hourBreakdown.sundayHolidayNight += pay.breakdown.sundayHolidayNight
    totals.regularDayPay += pay.regularDayPay
    totals.regularNightPay += pay.regularNightPay
    totals.sundayHolidayDayPay += pay.sundayHolidayDayPay
    totals.sundayHolidayNightPay += pay.sundayHolidayNightPay
    totals.totalPay += pay.totalPay
  }

  // Round hour breakdowns
  totals.hourBreakdown.regularDay = Math.round(totals.hourBreakdown.regularDay * 100) / 100
  totals.hourBreakdown.regularNight = Math.round(totals.hourBreakdown.regularNight * 100) / 100
  totals.hourBreakdown.sundayHolidayDay = Math.round(totals.hourBreakdown.sundayHolidayDay * 100) / 100
  totals.hourBreakdown.sundayHolidayNight = Math.round(totals.hourBreakdown.sundayHolidayNight * 100) / 100
  totals.hourBreakdown.totalHours =
    totals.hourBreakdown.regularDay +
    totals.hourBreakdown.regularNight +
    totals.hourBreakdown.sundayHolidayDay +
    totals.hourBreakdown.sundayHolidayNight
  totals.totalHours = totals.hourBreakdown.totalHours

  return totals
}

/**
 * Formats COP currency.
 */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
