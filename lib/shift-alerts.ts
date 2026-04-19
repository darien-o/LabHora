/**
 * Utilidades de alertas de turno.
 * Funciones puras para determinar cuándo mostrar alertas
 * de turno próximo y alertas de no-show.
 */

// ── Helpers internos ────────────────────────────────────────

/**
 * Combina una fecha "YYYY-MM-DD" y una hora "HH:mm" en un Date local.
 */
function buildShiftDateTime(shiftDate: string, shiftStartTime: string): Date {
  const [y, m, d] = shiftDate.split("-").map(Number)
  const [hours, minutes] = shiftStartTime.split(":").map(Number)
  return new Date(y, m - 1, d, hours, minutes, 0, 0)
}

// ── Funciones públicas ──────────────────────────────────────

/**
 * Determina si una alerta de turno próximo debe mostrarse.
 *
 * Retorna true si el turno está a 30 minutos o menos de su inicio
 * Y el turno aún no ha comenzado (diferencia > 0).
 *
 * - 0 < minutesUntilShift <= 30 → true
 * - minutesUntilShift <= 0 (ya empezó) → false
 * - minutesUntilShift > 30 → false
 */
export function shouldShowUpcomingAlert(
  shiftDate: string,
  shiftStartTime: string,
  currentTime: Date,
): boolean {
  const shiftStart = buildShiftDateTime(shiftDate, shiftStartTime)
  const diffMs = shiftStart.getTime() - currentTime.getTime()
  const diffMinutes = diffMs / 60_000

  return diffMinutes > 0 && diffMinutes <= 30
}

/**
 * Determina si se debe generar una alerta de no-show.
 *
 * Retorna true si han pasado más de 60 minutos desde el inicio del turno
 * sin confirmación.
 *
 * - confirmed === true → false (siempre)
 * - minutesSinceShiftStart > 60 AND confirmed === false → true
 * - minutesSinceShiftStart <= 60 → false
 */
export function shouldGenerateNoShowAlert(
  shiftDate: string,
  shiftStartTime: string,
  currentTime: Date,
  confirmed: boolean,
): boolean {
  if (confirmed) return false

  const shiftStart = buildShiftDateTime(shiftDate, shiftStartTime)
  const diffMs = currentTime.getTime() - shiftStart.getTime()
  const minutesSinceStart = diffMs / 60_000

  return minutesSinceStart > 60
}
