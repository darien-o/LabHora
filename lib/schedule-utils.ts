/**
 * Utilidades de programación de turnos.
 * Funciones puras para generación de registros multi-día,
 * instancias de turnos repetitivos, detección de conflictos
 * con bloqueos, y cálculos de semana/día.
 */

// ── Interfaces ──────────────────────────────────────────────

export interface MultiDayConfig {
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  startTime: string  // HH:mm — hora inicio del primer día
  endTime: string    // HH:mm — hora fin del último día
}

export interface ScheduleBlock {
  rowIndex: number
  personName: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  startTime?: string // HH:mm (opcional — vacío = todo el día)
  endTime?: string   // HH:mm
  repeat?: "weekly"
  repeatEndDate?: string
  reason?: string
}

export interface DayRecord {
  date: string      // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string   // HH:mm
}

// ── Helpers internos ────────────────────────────────────────

/** Parsea "YYYY-MM-DD" a un Date en hora local (mediodía para evitar problemas de zona). */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Formatea un Date a "YYYY-MM-DD". */
function fmtDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Cuenta los días entre dos fechas (inclusive). */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 86_400_000
  // Normalizar a medianoche para evitar problemas de DST
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((e.getTime() - s.getTime()) / msPerDay) + 1
}

// ── Funciones públicas ──────────────────────────────────────

/**
 * Genera registros individuales para un registro multi-día.
 *
 * - Rango de un solo día (startDate === endDate): un registro con startTime→endTime.
 * - Primer día: startTime → 23:59
 * - Días intermedios: 00:00 → 23:59
 * - Último día: 00:00 → endTime
 */
export function generateMultiDayRecords(config: MultiDayConfig): DayRecord[] {
  const start = parseDate(config.startDate)
  const end = parseDate(config.endDate)
  const totalDays = daysBetween(start, end)

  if (totalDays <= 0) return []

  // Caso de un solo día
  if (totalDays === 1) {
    return [{ date: config.startDate, startTime: config.startTime, endTime: config.endTime }]
  }

  const records: DayRecord[] = []

  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start)
    current.setDate(current.getDate() + i)
    const dateStr = fmtDate(current)

    if (i === 0) {
      // Primer día
      records.push({ date: dateStr, startTime: config.startTime, endTime: "23:59" })
    } else if (i === totalDays - 1) {
      // Último día
      records.push({ date: dateStr, startTime: "00:00", endTime: config.endTime })
    } else {
      // Día intermedio
      records.push({ date: dateStr, startTime: "00:00", endTime: "23:59" })
    }
  }

  return records
}

/**
 * Genera instancias de turno para un turno repetitivo.
 *
 * - "daily": una instancia por cada día del rango [startDate, endDate].
 * - "weekly": una instancia por semana, en el mismo día de la semana que startDate.
 */
export function generateRepeatInstances(
  startDate: string,
  endDate: string,
  frequency: "daily" | "weekly",
  startTime: string,
  endTime: string,
): DayRecord[] {
  const start = parseDate(startDate)
  const end = parseDate(endDate)

  if (end < start) return []

  const instances: DayRecord[] = []
  const step = frequency === "daily" ? 1 : 7
  const current = new Date(start)

  while (current <= end) {
    instances.push({
      date: fmtDate(current),
      startTime,
      endTime,
    })
    current.setDate(current.getDate() + step)
  }

  return instances
}

/**
 * Detecta si un turno entra en conflicto con algún bloqueo activo.
 *
 * Retorna el primer bloqueo que genera conflicto, o null si no hay conflicto.
 * Un bloqueo sin startTime/endTime cubre todo el día.
 * Un bloqueo con startTime/endTime solo bloquea ese rango horario.
 */
export function checkBlockConflicts(
  personName: string,
  date: string,
  startTime: string,
  endTime: string,
  blocks: ScheduleBlock[],
): ScheduleBlock | null {
  for (const block of blocks) {
    // Solo aplica al mismo cuidador
    if (block.personName !== personName) continue

    // Verificar si la fecha cae dentro del rango del bloqueo
    if (!isDateInBlockRange(date, block)) continue

    // Si el bloqueo no tiene rango horario, cubre todo el día → conflicto
    if (!block.startTime || !block.endTime) {
      return block
    }

    // Verificar solapamiento de horarios
    if (startTime < block.endTime && endTime > block.startTime) {
      return block
    }
  }

  return null
}

/**
 * Verifica si una fecha cae dentro del rango de un bloqueo,
 * considerando repetición semanal.
 */
function isDateInBlockRange(date: string, block: ScheduleBlock): boolean {
  const d = parseDate(date)
  const blockStart = parseDate(block.startDate)
  const blockEnd = parseDate(block.endDate)

  // Caso simple: sin repetición
  if (!block.repeat) {
    return d >= blockStart && d <= blockEnd
  }

  // Repetición semanal: verificar si la fecha cae en el mismo día de la semana
  // dentro del período de repetición
  if (block.repeat === "weekly") {
    const repeatEnd = block.repeatEndDate ? parseDate(block.repeatEndDate) : blockEnd

    // La fecha debe estar después del inicio del bloqueo y antes del fin de repetición
    if (d < blockStart || d > repeatEnd) return false

    // Calcular la duración del bloqueo original en días
    const blockDuration = daysBetween(blockStart, blockEnd) - 1 // 0-indexed

    // Verificar si la fecha cae en una repetición semanal del bloqueo
    const daysDiff = Math.round((d.getTime() - blockStart.getTime()) / 86_400_000)
    const weekOffset = daysDiff % 7
    return weekOffset >= 0 && weekOffset <= blockDuration
  }

  return false
}

/**
 * Retorna el lunes de la semana para una fecha dada.
 * Si la fecha ya es lunes, retorna la misma fecha (a medianoche).
 */
export function getWeekStartMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Dom, 1=Lun, ..., 6=Sáb
  // Calcular cuántos días restar para llegar al lunes
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Retorna el siguiente día calendario (fecha + 1 día).
 * No salta fines de semana — incluye sábados y domingos.
 */
export function getNextCalendarDay(date: string): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + 1)
  return fmtDate(d)
}
