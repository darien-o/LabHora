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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Clock, AlertTriangle } from "lucide-react"

interface Person {
  id: string
  name: string
}

interface TimeEntry {
  id: string
  personName: string
  clockIn: string
  clockOut?: string
  date: string
}

interface HistoricalEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person | null
  onConfirm: (clockIn: string, clockOut: string) => void
  timeEntries: TimeEntry[]
}

export function HistoricalEntryDialog({
  open,
  onOpenChange,
  person,
  onConfirm,
  timeEntries,
}: HistoricalEntryDialogProps) {
  const [clockInDate, setClockInDate] = useState("")
  const [clockInTime, setClockInTime] = useState("")
  const [clockOutDate, setClockOutDate] = useState("")
  const [clockOutTime, setClockOutTime] = useState("")
  const [error, setError] = useState("")
  const [conflictDetails, setConflictDetails] = useState("")

  const formatDateTime = (dateStr: string, timeStr: string) => {
    const date = new Date(`${dateStr}T${timeStr}`)
    return (
      date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }) +
      " a las " +
      date.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    )
  }

  const checkForConflicts = (clockIn: Date, clockOut: Date) => {
    if (!person) return null

    const conflictingEntry = timeEntries.find((entry) => {
      if (entry.personName !== person.name) return false

      const entryStart = new Date(entry.clockIn)
      const entryEnd = entry.clockOut ? new Date(entry.clockOut) : new Date()

      // Check for overlap
      return clockIn < entryEnd && clockOut > entryStart
    })

    if (conflictingEntry) {
      const conflictStart = new Date(conflictingEntry.clockIn)
      const conflictEnd = conflictingEntry.clockOut ? new Date(conflictingEntry.clockOut) : new Date()

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

      return `${person.name} ya tiene un registro desde ${startStr} hasta ${endStr}${conflictingEntry.clockOut ? "" : " (en curso)"}.`
    }

    return null
  }

  const validateAndSubmit = () => {
    setError("")
    setConflictDetails("")

    if (!clockInDate || !clockInTime || !clockOutDate || !clockOutTime) {
      setError("Por favor completa todos los campos")
      return
    }

    const clockInDateTime = new Date(`${clockInDate}T${clockInTime}`)
    const clockOutDateTime = new Date(`${clockOutDate}T${clockOutTime}`)

    if (clockInDateTime >= clockOutDateTime) {
      setError("La hora de salida debe ser posterior a la de entrada")
      return
    }

    const hours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60)
    if (hours > 24) {
      setError("El turno no puede ser mayor a 24 horas")
      return
    }

    if (clockInDateTime > new Date()) {
      setError("No se pueden crear registros para fechas futuras")
      return
    }

    // Check for conflicts with detailed message
    const conflictMessage = checkForConflicts(clockInDateTime, clockOutDateTime)
    if (conflictMessage) {
      setError("Conflicto de horarios detectado")
      setConflictDetails(conflictMessage)
      return
    }

    onConfirm(clockInDateTime.toISOString(), clockOutDateTime.toISOString())
    handleClose()
  }

  const handleClose = () => {
    onOpenChange(false)
    setClockInDate("")
    setClockInTime("")
    setClockOutDate("")
    setClockOutTime("")
    setError("")
    setConflictDetails("")
  }

  const calculateDuration = () => {
    if (!clockInDate || !clockInTime || !clockOutDate || !clockOutTime) return ""

    const clockIn = new Date(`${clockInDate}T${clockInTime}`)
    const clockOut = new Date(`${clockOutDate}T${clockOutTime}`)

    if (clockIn >= clockOut) return "Inválido"

    const hours = Math.round(((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)) * 10) / 10
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Registro Histórico
          </DialogTitle>
          <DialogDescription>
            Alguien más está fichado actualmente. Crea un registro histórico para <strong>{person?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hora de Entrada
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="clockin-date" className="text-xs text-gray-600">
                  Fecha
                </Label>
                <Input
                  id="clockin-date"
                  type="date"
                  value={clockInDate}
                  onChange={(e) => setClockInDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="clockin-time" className="text-xs text-gray-600">
                  Hora
                </Label>
                <Input
                  id="clockin-time"
                  type="time"
                  value={clockInTime}
                  onChange={(e) => setClockInTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hora de Salida
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="clockout-date" className="text-xs text-gray-600">
                  Fecha
                </Label>
                <Input
                  id="clockout-date"
                  type="date"
                  value={clockOutDate}
                  onChange={(e) => setClockOutDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="clockout-time" className="text-xs text-gray-600">
                  Hora
                </Label>
                <Input
                  id="clockout-time"
                  type="time"
                  value={clockOutTime}
                  onChange={(e) => setClockOutTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {calculateDuration() && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Duración:</strong> {calculateDuration()}
              </p>
              {clockInDate && clockInTime && clockOutDate && clockOutTime && (
                <p className="text-xs text-blue-600 mt-1">
                  Del {formatDateTime(clockInDate, clockInTime)} al {formatDateTime(clockOutDate, clockOutTime)}
                </p>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{error}</p>
                  {conflictDetails && <p className="text-sm">{conflictDetails}</p>}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={validateAndSubmit} className="bg-blue-600 hover:bg-blue-700">
            Crear Registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
