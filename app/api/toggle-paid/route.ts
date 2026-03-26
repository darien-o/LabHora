export const revalidate = 0

import { NextResponse } from "next/server"
import { togglePaidStatus } from "@/lib/google-sheets"

export async function POST(request: Request) {
  try {
    const { rowIndex, paid } = await request.json()

    if (!rowIndex || typeof paid !== "boolean") {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 })
    }

    await togglePaidStatus(rowIndex, paid)

    return NextResponse.json({
      success: true,
      message: paid ? "Marcado como pagado" : "Marcado como no pagado",
    })
  } catch (error: any) {
    console.error("Error al cambiar estado de pago:", error)
    return NextResponse.json({ error: error.message || "Error al cambiar estado de pago" }, { status: 500 })
  }
}
