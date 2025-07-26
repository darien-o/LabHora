import { google } from "googleapis"

// Enhanced authentication configuration
const getAuthClient = () => {
  try {
    const credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error("Missing Google Sheets credentials")
    }

    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file"],
    })
  } catch (error) {
    console.error("Error creating auth client:", error)
    throw new Error("Failed to authenticate with Google Sheets")
  }
}

const getSheets = async () => {
  const auth = getAuthClient()
  return google.sheets({ version: "v4", auth })
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID

// Sheet names
const SHEETS = {
  REGISTRO: "Registro",
  CUIDADORES: "Cuidadores",
}

// Timezone conversion to GMT-5 (Colombia/Ecuador time)
const convertToGMTMinus5 = (date: Date): Date => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  const gmtMinus5 = new Date(utc + -5 * 3600000)
  return gmtMinus5
}

const formatDateTimeForSheet = (date: Date): string => {
  const gmtMinus5Date = convertToGMTMinus5(date)
  return gmtMinus5Date.toLocaleString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Bogota", // GMT-5 timezone
  })
}

export interface TimeEntry {
  id: string
  dateTimeIn: string
  dateTimeOut?: string
  personName: string
  totalTime?: number
}

export interface Person {
  name: string
}

// Get caregivers list
export async function getCuidadores(): Promise<Person[]> {
  try {
    const sheets = await getSheets()

    if (!SPREADSHEET_ID) {
      throw new Error("GOOGLE_SHEET_ID environment variable is not set")
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CUIDADORES}!A:A`,
    })

    const rows = response.data.values || []

    // Filter empty rows and header if exists
    const names = rows
      .flat()
      .filter((name) => name && typeof name === "string" && name.trim() !== "" && name.toLowerCase() !== "nombre")

    if (names.length === 0) {
      console.warn("No caregivers found in sheet")
      return []
    }

    return names.map((name) => ({ name: name.trim() }))
  } catch (error: any) {
    console.error("Error getting caregivers:", error)
    if (error.message?.includes("permission")) {
      throw new Error(
        "No tienes permisos para acceder a la hoja de cálculo. Verifica que la hoja esté compartida con la cuenta de servicio.",
      )
    }
    throw new Error(`Error al obtener la lista de cuidadores: ${error.message}`)
  }
}

// Get time entries
export async function getTimeEntries(): Promise<TimeEntry[]> {
  try {
    const sheets = await getSheets()

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.REGISTRO}!A:D`,
    })

    const rows = response.data.values || []
    if (rows.length <= 1) {
      console.log("No time entries found in sheet")
      return [] // Return empty array
    }

    // Skip header row if it exists and filter valid rows
    const dataRows = rows.slice(1).filter((row) => row.length > 0 && row[0] && row[2])

    return dataRows.map((row, index) => ({
      id: `entry-${index}-${Date.now()}`, // Unique ID
      dateTimeIn: row[0],
      dateTimeOut: row[1] || undefined,
      personName: row[2],
      totalTime: row[3] ? Number.parseFloat(row[3]) : undefined,
    }))
  } catch (error: any) {
    console.error("Error getting time entries:", error)
    if (error.message?.includes("permission")) {
      throw new Error("No tienes permisos para acceder a la hoja de cálculo.")
    }
    throw new Error(`Error al obtener los registros de tiempo: ${error.message}`)
  }
}

// Get active person
export async function getActivePerson(): Promise<{ name: string; clockIn: string } | null> {
  try {
    console.log("Getting active person from sheet...")
    const entries = await getTimeEntries()

    if (entries.length === 0) {
      console.log("No entries found, no active person")
      return null
    }

    // Find entries without clock out (active entries)
    const activeEntries = entries.filter((entry) => !entry.dateTimeOut)

    if (activeEntries.length === 0) {
      console.log("No active entries found")
      return null
    }

    // Get the most recent active entry
    const mostRecentActive = activeEntries.sort((a, b) => {
      const dateA = parseSpanishDateTime(a.dateTimeIn)
      const dateB = parseSpanishDateTime(b.dateTimeIn)
      return dateB.getTime() - dateA.getTime()
    })[0]

    console.log("Active person found:", mostRecentActive.personName)
    return {
      name: mostRecentActive.personName,
      clockIn: mostRecentActive.dateTimeIn,
    }
  } catch (error) {
    console.error("Error getting active person:", error)
    return null // Return null, don't default to anyone
  }
}

// Clock in with GMT-5 timezone
export async function clockIn(personName: string, timestamp: string): Promise<void> {
  try {
    const sheets = await getSheets()

    // Check that no other person is active
    const activePerson = await getActivePerson()
    if (activePerson && activePerson.name !== personName) {
      throw new Error(`${activePerson.name} ya está fichado. Debe fichar salida primero.`)
    }

    // Check that this person is not already clocked in
    if (activePerson && activePerson.name === personName) {
      throw new Error(`${personName} ya está fichado.`)
    }

    // Convert to GMT-5 and format for sheet
    const timestampDate = new Date(timestamp)
    const formattedTimestamp = formatDateTimeForSheet(timestampDate)

    console.log(`Clocking in ${personName} at ${formattedTimestamp} (GMT-5)`)

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.REGISTRO}!A:D`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[formattedTimestamp, "", personName, ""]],
      },
    })
  } catch (error: any) {
    console.error("Error clocking in:", error)
    if (error.message?.includes("permission")) {
      throw new Error(
        "No tienes permisos para escribir en la hoja de cálculo. Verifica los permisos de la cuenta de servicio.",
      )
    }
    throw error
  }
}

// Clock out with GMT-5 timezone
export async function clockOut(personName: string, timestamp: string): Promise<void> {
  try {
    const sheets = await getSheets()

    // Get all records
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.REGISTRO}!A:D`,
    })

    const rows = response.data.values || []
    if (rows.length <= 1) {
      throw new Error("No se encontró registro de entrada para esta persona")
    }

    // Find the last entry without clock out for this person
    let lastEntryRowIndex = -1
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i]
      if (row[2] === personName && !row[1]) {
        lastEntryRowIndex = i
        break
      }
    }

    if (lastEntryRowIndex === -1) {
      throw new Error(`No se encontró registro de entrada activo para ${personName}`)
    }

    const clockInTime = rows[lastEntryRowIndex][0]

    // Convert to GMT-5 and format for sheet
    const timestampDate = new Date(timestamp)
    const formattedTimestamp = formatDateTimeForSheet(timestampDate)

    // Calculate total hours
    const clockInDate = parseSpanishDateTime(clockInTime)
    const clockOutDate = timestampDate
    const totalHours = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60)

    console.log(`Clocking out ${personName} at ${formattedTimestamp} (GMT-5)`)

    // Update the row with clock out and total time
    const rowNumber = lastEntryRowIndex + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.REGISTRO}!B${rowNumber}:D${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[formattedTimestamp, personName, totalHours.toFixed(2)]],
      },
    })
  } catch (error: any) {
    console.error("Error clocking out:", error)
    throw error
  }
}

// Add historical entry with GMT-5 timezone
export async function addHistoricalEntry(
  personName: string,
  clockInTimestamp: string,
  clockOutTimestamp: string,
): Promise<void> {
  try {
    const sheets = await getSheets()

    // Enhanced conflict checking
    const hasConflicts = await checkTimeConflicts(personName, clockInTimestamp, clockOutTimestamp)
    if (hasConflicts) {
      const conflictDetails = await getConflictDetails(personName, clockInTimestamp, clockOutTimestamp)
      throw new Error(`Conflicto de horarios: ${conflictDetails}`)
    }

    // Convert to GMT-5 and format for sheet
    const clockInDate = new Date(clockInTimestamp)
    const clockOutDate = new Date(clockOutTimestamp)

    const clockInFormatted = formatDateTimeForSheet(clockInDate)
    const clockOutFormatted = formatDateTimeForSheet(clockOutDate)

    // Calculate total hours
    const totalHours = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60)

    console.log(`Adding historical entry for ${personName}: ${clockInFormatted} to ${clockOutFormatted} (GMT-5)`)

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.REGISTRO}!A:D`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[clockInFormatted, clockOutFormatted, personName, totalHours.toFixed(2)]],
      },
    })
  } catch (error: any) {
    console.error("Error adding historical entry:", error)
    throw error
  }
}

// Enhanced conflict checking
export async function checkTimeConflicts(
  personName: string,
  clockInTimestamp: string,
  clockOutTimestamp: string,
): Promise<boolean> {
  try {
    const entries = await getTimeEntries()

    const newStart = new Date(clockInTimestamp)
    const newEnd = new Date(clockOutTimestamp)

    return entries.some((entry) => {
      if (entry.personName !== personName) return false

      const entryStart = parseSpanishDateTime(entry.dateTimeIn)
      const entryEnd = entry.dateTimeOut ? parseSpanishDateTime(entry.dateTimeOut) : new Date()

      // Check for overlap
      return newStart < entryEnd && newEnd > entryStart
    })
  } catch (error) {
    console.error("Error checking conflicts:", error)
    return false
  }
}

// Get detailed conflict information
export async function getConflictDetails(
  personName: string,
  clockInTimestamp: string,
  clockOutTimestamp: string,
): Promise<string> {
  try {
    const entries = await getTimeEntries()

    const newStart = new Date(clockInTimestamp)
    const newEnd = new Date(clockOutTimestamp)

    const conflictingEntry = entries.find((entry) => {
      if (entry.personName !== personName) return false

      const entryStart = parseSpanishDateTime(entry.dateTimeIn)
      const entryEnd = entry.dateTimeOut ? parseSpanishDateTime(entry.dateTimeOut) : new Date()

      return newStart < entryEnd && newEnd > entryStart
    })

    if (conflictingEntry) {
      const conflictStart = parseSpanishDateTime(conflictingEntry.dateTimeIn)
      const conflictEnd = conflictingEntry.dateTimeOut ? parseSpanishDateTime(conflictingEntry.dateTimeOut) : new Date()

      const startStr =
        conflictStart.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }) +
        " a las " +
        conflictStart.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })

      const endStr = conflictEnd.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })

      return `${personName} ya tiene un registro desde ${startStr} hasta ${endStr}${conflictingEntry.dateTimeOut ? "" : " (en curso)"}.`
    }

    return "Conflicto de horarios detectado"
  } catch (error) {
    console.error("Error getting conflict details:", error)
    return "Error al verificar conflictos"
  }
}

// Helper function to parse Spanish formatted datetime
function parseSpanishDateTime(dateTimeStr: string): Date {
  try {
    // Handle format: "DD/MM/YYYY, HH:mm:ss"
    const [datePart, timePart] = dateTimeStr.split(", ")
    const [day, month, year] = datePart.split("/")
    const [hour, minute, second] = timePart.split(":")

    return new Date(
      Number.parseInt(year),
      Number.parseInt(month) - 1, // Month is 0-indexed
      Number.parseInt(day),
      Number.parseInt(hour),
      Number.parseInt(minute),
      Number.parseInt(second || "0"),
    )
  } catch (error) {
    console.error("Error parsing Spanish datetime:", dateTimeStr, error)
    return new Date(dateTimeStr) // Fallback to standard parsing
  }
}
