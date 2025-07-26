import { NextResponse } from "next/server"
import { addHistoricalEntry, checkTimeConflicts } from "@/lib/google-sheets"

export async function POST(request: Request) {
  try {
    const { personName, clockIn, clockOut } = await request.json()

    if (!personName || !clockIn || !clockOut) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 })
    }

    // Verificar conflictos
    const hasConflicts = await checkTimeConflicts(personName, clockIn, clockOut)
    if (hasConflicts) {
      // Get detailed conflict message
      const conflictDetails = await import("@/lib/google-sheets").then(mod =>
        mod.getConflictDetails(personName, clockIn, clockOut)
      )
      return NextResponse.json({ error: conflictDetails }, { status: 400 })
    }

    await addHistoricalEntry(personName, clockIn, clockOut)

    return NextResponse.json({
      success: true,
      message: "Entrada histórica agregada correctamente",
      data: { personName, clockIn, clockOut },
    })
  } catch (error: any) {
    console.error("Error al agregar entrada histórica:", error)
    return NextResponse.json({ error: error.message || "Error al agregar entrada histórica" }, { status: 500 })
  }
}
