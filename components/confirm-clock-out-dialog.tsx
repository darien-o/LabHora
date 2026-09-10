"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Clock, Check, Pencil } from "lucide-react"
import { toLocalISO, parseSpanishDateTime } from "@/lib/utils"

interface Person {
  id: string
  name: string
  lastClockIn?: string
}

interface ConfirmClockOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person | null
  onConfirm: (timestamp: string) => void
}

export function ConfirmClockOutDialog({ open, onOpenChange, person, onConfirm }: ConfirmClockOutDialogProps) {
  const [mode, setMode] = useState<"confirm" | "custom">("confirm")
  const [customTime, setCustomTime] = useState("")
  const [customDate, setCustomDate] = useState("")

  const calculateHours = () => {
    if (!person?.lastClockIn) return 0
    const clockIn = parseSpanishDateTime(person.lastClockIn)
    if (!clockIn) return 0
    return Math.round(((new Date().getTime() - clockIn.getTime()) / (1000 * 60 * 60)) * 10) / 10
  }

  const handleConfirmNow = () => {
    onConfirm(new Date().toISOString())
    handleClose()
  }

  const handleConfirmCustom = () => {
    if (!customDate || !customTime) return
    const ts = toLocalISO(customDate, customTime)
    onConfirm(ts)
    handleClose()
  }

  const handleClose = () => {
    onOpenChange(false)
    setMode("confirm")
    setCustomTime("")
    setCustomDate("")
  }

  const hours = calculateHours()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Turno Largo Detectado
          </DialogTitle>
          <DialogDescription className="text-base text-gray-700">
            <strong>{person?.name}</strong> lleva <strong>{hours} horas</strong> fichado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <span className="text-base font-semibold text-orange-900">Resumen del turno</span>
            </div>
            <p className="text-base text-orange-800">
              Entrada: {person?.lastClockIn ? (parseSpanishDateTime(person.lastClockIn)?.toLocaleString("es-ES") ?? "?") : "?"}
            </p>
            <p className="text-lg font-bold text-orange-900 mt-1">
              Duración: {hours} horas
            </p>
          </div>

          {mode === "confirm" && (
            <div className="space-y-3">
              <p className="text-base text-gray-700 font-medium">
                ¿Realmente trabajaste {hours} horas o quieres poner otra hora de salida?
              </p>
              <Button
                onClick={handleConfirmNow}
                className="w-full h-14 text-base font-semibold bg-green-600 hover:bg-green-700 rounded-xl"
              >
                <Check className="h-5 w-5 mr-2" />
                Sí, trabajé {hours} horas — Marcar salida ahora
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode("custom")}
                className="w-full h-14 text-base font-medium rounded-xl"
              >
                <Pencil className="h-5 w-5 mr-2" />
                No, quiero poner otra hora de salida
              </Button>
            </div>
          )}

          {mode === "custom" && (
            <div className="space-y-4">
              <p className="text-base text-gray-700 font-medium">
                Indica la hora real de salida:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Fecha</Label>
                  <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Hora</Label>
                  <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
                </div>
              </div>
              <Button
                onClick={handleConfirmCustom}
                disabled={!customDate || !customTime}
                className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                <Check className="h-5 w-5 mr-2" />
                Confirmar salida
              </Button>
              <Button variant="ghost" onClick={() => setMode("confirm")} className="w-full text-base">
                Volver
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="h-12 text-base">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
