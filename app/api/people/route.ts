import { NextResponse } from "next/server"
import { getCuidadores, getActivePerson } from "@/lib/google-sheets"

export async function GET() {
  try {
    console.log("API: Getting people data from sheet...")

    // Get data from sheet - NO MOCKED DATA
    const [cuidadores, activePerson] = await Promise.all([getCuidadores(), getActivePerson()])

    console.log("API: Cuidadores found:", cuidadores.length)
    console.log("API: Active person:", activePerson?.name || "None")

    // Build people array with actual data from sheet
    const people = cuidadores.map((cuidador, index) => ({
      id: `person-${index}-${cuidador.name.replace(/\s+/g, "-")}`, // More unique ID
      name: cuidador.name,
      isActive: activePerson?.name === cuidador.name, // Only active if actually in sheet
      lastClockIn: activePerson?.name === cuidador.name ? activePerson.clockIn : undefined,
      avatar: `/placeholder.svg?height=40&width=40&query=${encodeURIComponent(cuidador.name)}`,
    }))

    // Add cache headers to prevent stale data
    const response = NextResponse.json(people)
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")

    return response
  } catch (error: any) {
    console.error("API Error getting people:", error)
    return NextResponse.json(
      {
        error: error.message || "Error al obtener la lista de cuidadores",
      },
      { status: 500 },
    )
  }
}
