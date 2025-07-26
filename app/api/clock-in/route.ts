import { NextResponse } from "next/server"
import { clockIn } from "@/lib/google-sheets"

export async function POST(request: Request) {
  try {
    const { personName, timestamp } = await request.json()

    if (!personName || !timestamp) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 })
    }

    await clockIn(personName, timestamp)

    return NextResponse.json({
      success: true,
      message: "Entrada registrada correctamente",
      data: { personName, timestamp },
    })
  } catch (error: any) {
    console.error("Error al registrar entrada:", error)
    return NextResponse.json({ error: error.message || "Error al registrar entrada" }, { status: 500 })
  }
}
