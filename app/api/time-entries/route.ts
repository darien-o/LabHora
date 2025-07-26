import { NextResponse } from "next/server"
import { getTimeEntries } from "@/lib/google-sheets"

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

export async function GET() {
  try {
    console.log("API: Getting time entries from sheet...")

    // Get actual data from sheet - NO MOCKED DATA
    const entries = await getTimeEntries()

    console.log("API: Time entries found:", entries.length)

    // Format entries for frontend
    const formattedEntries = entries.map((entry) => ({
      id: entry.id,
      personName: entry.personName,
      clockIn: entry.dateTimeIn,
      clockOut: entry.dateTimeOut,
      totalHours: entry.totalTime,
      date: entry.dateTimeIn ? new Date(parseSpanishDateTime(entry.dateTimeIn)).toISOString().split("T")[0] : "",
    }))

    // Add cache headers to prevent stale data
    const response = NextResponse.json(formattedEntries)
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")

    return response
  } catch (error: any) {
    console.error("API Error getting time entries:", error)
    return NextResponse.json(
      {
        error: error.message || "Error al obtener los registros de tiempo",
      },
      { status: 500 },
    )
  }
}
