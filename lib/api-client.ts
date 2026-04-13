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
    body: JSON.stringify({ personName, timestamp }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al fichar entrada")
  return data
}

export async function postClockOut(personName: string, timestamp: string) {
  const res = await fetch(url("clock-out"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ personName, timestamp }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Error al fichar salida")
  return data
}

export async function postHistoricalEntry(personName: string, clockIn: string, clockOut: string) {
  const res = await fetch(url("historical-entry"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ personName, clockIn, clockOut }),
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
    body: JSON.stringify({ action: "edit", rowIndex, clockIn, clockOut }),
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
