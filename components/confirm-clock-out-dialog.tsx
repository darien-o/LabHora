"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle } from "lucide-react"

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
  const [customTime, setCustomTime] = useState("")
  const [customDate, setCustomDate] = useState("")

  const calculateHours = () => {
    if (!person?.lastClockIn) return 0
    const clockIn = new Date(person.lastClockIn)
    const now = new Date()
    return Math.round(((now.getTime() - clockIn.getTime()) / (1000 * 60 * 60)) * 10) / 10
  }

  const handleConfirm = () => {
    let timestamp = new Date().toISOString()

    if (customDate && customTime) {
      const customDateTime = new Date(`${customDate}T${customTime}`)
      timestamp = customDateTime.toISOString()
    }

    onConfirm(timestamp)
    onOpenChange(false)
    setCustomTime("")
    setCustomDate("")
  }

  const handleCancel = () => {
    onOpenChange(false)
    setCustomTime("")
    setCustomDate("")
  }

  const hours = calculateHours()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Turno Largo Detectado
          </DialogTitle>
          <DialogDescription>
            {person?.name} ha estado fichado durante {hours} horas. Por favor confirma la hora de salida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Entrada:</strong>{" "}
              {person?.lastClockIn ? new Date(person.lastClockIn).toLocaleString("es-ES") : "Desconocido"}
            </p>
            <p className="text-sm text-orange-800">
              <strong>Duración:</strong> {hours} horas
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Ajustar hora de salida (opcional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date" className="text-xs text-gray-600">
                  Fecha
                </Label>
                <Input id="date" type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="time" className="text-xs text-gray-600">
                  Hora
                </Label>
                <Input id="time" type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="bg-orange-600 hover:bg-orange-700">
            Confirmar Salida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
