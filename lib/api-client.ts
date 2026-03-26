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
