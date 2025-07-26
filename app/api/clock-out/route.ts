import { NextResponse } from "next/server"
import { clockOut } from "@/lib/google-sheets"

export async function POST(request: Request) {
  try {
    const { personName, timestamp } = await request.json()

    if (!personName || !timestamp) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 })
    }

    await clockOut(personName, timestamp)

    return NextResponse.json({
      success: true,
      message: "Salida registrada correctamente",
      data: { personName, timestamp },
    })
  } catch (error: any) {
    console.error("Error al registrar salida:", error)
    return NextResponse.json({ error: error.message || "Error al registrar salida" }, { status: 500 })
  }
}
