/**
 * Cliente API centralizado.
 *
 * En desarrollo (Next.js dev server) usa las rutas /api/*.
 * En producción (static export + PHP) usa las rutas del backend PHP.
 *
 * Cambia API_BASE para apuntar a tu hosting:
 *   - Desarrollo: "" (rutas relativas Next.js)
 *   - Producción: "/php-api" o "https://tudominio.com/php-api"
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production"

// En producción apunta al directorio PHP. Ajusta si tu estructura es diferente.
const API_BASE = IS_PRODUCTION ? "/php-api" : "/api"

// Extensión de archivos: .php en producción, nada en desarrollo (Next.js routes)
const EXT = IS_PRODUCTION ? ".php" : ""

function url(endpoint: string): string {
  return `${API_BASE}/${endpoint}${EXT}`
}

const NO_CACHE_HEADERS: HeadersInit = {
  "Cache-Control": "no-cache",
}

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
}

/**
 * Returns the IANA timezone of the current device (e.g. "America/Bogota",
 * "Europe/Madrid"). Falls back to "America/Bogota" if the browser doesn't
 * support the Intl API (very old browsers).
 */
function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "America/Bogota"
  }
}

// --- GET endpoints ---

export async function fetchPeople() {
  const res = await fetch(url("people"), {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
  })
  return res.json()
}

export async function fetchTimeEntries() {
  const res = await fetch(url("time-entries"), {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
  })
  return res.json()
}

// --- POST endpoints ---

export async function postClockIn(personName: string, timestamp: string) {
  const res = await fetch(url("clock-in"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ personName, timestamp, timezone: getDeviceTimezone() }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al registrar entrada")
  return data
}

export async function postClockOut(personName: string, timestamp: string) {
  const res = await fetch(url("clock-out"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ personName, timestamp, timezone: getDeviceTimezone() }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al registrar salida")
  return data
}

export async function postHistoricalEntry(personName: string, clockIn: string, clockOut: string) {
  const res = await fetch(url("historical-entry"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ personName, clockIn, clockOut, timezone: getDeviceTimezone() }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al agregar entrada histórica")
  return data
}

export async function postTogglePaid(rowIndex: number, paid: boolean) {
  const res = await fetch(url("toggle-paid"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ rowIndex, paid }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al cambiar estado de pago")
  return data
}

// --- Schedule endpoints ---

export async function fetchSchedule(weekStart: string) {
  const res = await fetch(`${url("schedule")}?weekStart=${weekStart}&_t=${Date.now()}`, {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
  })
  return res.json()
}

export async function postScheduleShift(data: {
  action: "add" | "remove"
  date?: string
  personName?: string
  startTime?: string
  endTime?: string
  rowIndex?: number
}) {
  const res = await fetch(url("schedule"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error al gestionar turno")
  return result
}

// --- Photo upload ---

export async function uploadPhoto(file: File, personName: string, note?: string) {
  const formData = new FormData()
  formData.append("photo", file)
  formData.append("personName", personName)
  if (note) formData.append("note", note)

  const res = await fetch(url("upload-photo"), {
    method: "POST",
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al subir foto")
  return data
}

// --- Edit/Delete entry ---

export async function postEditEntry(rowIndex: number, clockIn: string, clockOut: string) {
  const res = await fetch(url("edit-entry"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: "edit", rowIndex, clockIn, clockOut, timezone: getDeviceTimezone() }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al editar registro")
  return data
}

export async function postDeleteEntry(rowIndex: number) {
  const res = await fetch(url("edit-entry"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: "delete", rowIndex }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al eliminar registro")
  return data
}

// --- Recaudos (monthly collections) ---

export async function fetchRecaudos() {
  const base = url("recaudos")
  const sep = base.includes("?") ? "&" : "?"
  const res = await fetch(`${base}${sep}_t=${Date.now()}`, {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
  })
  return res.json()
}

export async function postRecaudo(data: {
  action: "add" | "edit" | "delete"
  month?: string
  amount?: number
  description?: string
  rowIndex?: number
}) {
  const res = await fetch(url("recaudos"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error en recaudos")
  return result
}

// --- Anticipos (advances) ---

export async function fetchAdvances(month?: string) {
  const base = url("anticipos")
  const params = new URLSearchParams()
  if (month) params.set("month", month)
  params.set("_t", String(Date.now()))
  const sep = base.includes("?") ? "&" : "?"
  const res = await fetch(`${base}${sep}${params.toString()}`, {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
  })
  return res.json()
}

export async function postAdvance(data: {
  action: "add" | "edit" | "delete"
  personName?: string
  amount?: number
  date?: string
  month?: string
  description?: string
  rowIndex?: number
}) {
  const res = await fetch(url("anticipos"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error en anticipos")
  return result
}

// --- Gastos (expenses / income) ---

export async function fetchExpenses(entryRowIndex?: number) {
  const base = url("gastos")
  const params = new URLSearchParams()
  if (entryRowIndex !== undefined) params.set("entryRowIndex", String(entryRowIndex))
  params.set("_t", String(Date.now()))
  const sep = base.includes("?") ? "&" : "?"
  const res = await fetch(`${base}${sep}${params.toString()}`, {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
  })
  return res.json()
}

export async function postExpense(data: {
  action: "add" | "delete"
  personName?: string
  type?: "expense" | "income"
  amount?: number
  description?: string
  entryRowIndex?: number
  rowIndex?: number
}) {
  const res = await fetch(url("gastos"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error en gastos")
  return result
}

// --- Recibos (payment receipts — multipart) ---

export async function fetchReceipts(month?: string) {
  const base = url("recibos")
  const params = new URLSearchParams()
  if (month) params.set("month", month)
  params.set("_t", String(Date.now()))
  const sep = base.includes("?") ? "&" : "?"
  const res = await fetch(`${base}${sep}${params.toString()}`, {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
  })
  return res.json()
}

export async function postReceipt(formData: FormData) {
  const res = await fetch(url("recibos"), {
    method: "POST",
    body: formData,
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error al crear recibo")
  return result
}

// --- Bloqueos (schedule blocks) ---

export async function fetchBlocks(weekStart?: string) {
  const base = url("bloqueos")
  const params = new URLSearchParams()
  if (weekStart) params.set("weekStart", weekStart)
  params.set("_t", String(Date.now()))
  const sep = base.includes("?") ? "&" : "?"
  const res = await fetch(`${base}${sep}${params.toString()}`, {
    cache: "no-store",
    headers: NO_CACHE_HEADERS,
  })
  return res.json()
}

export async function postBlock(data: {
  action: "add" | "remove"
  personName?: string
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  repeat?: "weekly" | ""
  repeatEndDate?: string
  reason?: string
  rowIndex?: number
}) {
  const res = await fetch(url("bloqueos"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error en bloqueos")
  return result
}

// --- Payment confirmation (caregiver confirms payment received) ---

export async function postPaymentConfirmation(entryRowIndex: number, amountReceived?: number) {
  const res = await fetch(url("confirm-payment"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ entryRowIndex, amountReceived }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error al confirmar pago")
  return result
}

// --- Bulk toggle paid (mass payment marking) ---

export async function postBulkTogglePaid(rowIndices: number[], paid: boolean) {
  const res = await fetch(url("toggle-paid"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: "bulk-toggle", rowIndices, paid }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error al marcar pagos masivamente")
  return result
}

// --- Schedule repeat (recurring shifts) ---

export async function postScheduleRepeat(data: {
  personName: string
  date: string
  startTime: string
  endTime: string
  frequency: "daily" | "weekly"
  endDate: string
}) {
  const res = await fetch(url("schedule"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: "add-repeat", ...data }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Error al crear turno repetitivo")
  return result
}
