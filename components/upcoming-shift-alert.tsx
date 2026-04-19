"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, CheckCircle2, AlertTriangle, Clock } from "lucide-react"
import { shouldShowUpcomingAlert, shouldGenerateNoShowAlert } from "@/lib/shift-alerts"
import { useAdmin } from "@/lib/admin-context"

interface ScheduledShift {
  date: string       // YYYY-MM-DD
  personName: string
  startTime: string  // HH:mm
  endTime: string    // HH:mm
}

interface UpcomingShiftAlertProps {
  shifts: ScheduledShift[]
  personName: string
  onConfirmShift: (date: string, startTime: string) => void
}

/** Formats "HH:mm" to "H:mm AM/PM" */
function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const p = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, "0")} ${p}`
}

export function UpcomingShiftAlert({
  shifts,
  personName,
  onConfirmShift,
}: UpcomingShiftAlertProps) {
  const { addAlert } = useAdmin()
  const [now, setNow] = useState(() => new Date())
  const [confirmedShifts, setConfirmedShifts] = useState<Set<string>>(new Set())
  const noShowFiredRef = useRef<Set<string>>(new Set())

  // Poll current time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Generate no-show alerts for unconfirmed shifts past 60 minutes
  useEffect(() => {
    const myShifts = shifts.filter((s) => s.personName === personName)
    for (const shift of myShifts) {
      const key = `${shift.date}-${shift.startTime}`
      const isConfirmed = confirmedShifts.has(key)
      if (
        shouldGenerateNoShowAlert(shift.date, shift.startTime, now, isConfirmed) &&
        !noShowFiredRef.current.has(key)
      ) {
        noShowFiredRef.current.add(key)
        addAlert({
          type: "no-show" as const,
          message: `${personName} no se presentó al turno programado de ${to12h(shift.startTime)} – ${to12h(shift.endTime)} el ${shift.date}. Han pasado más de 60 minutos sin confirmación.`,
          personName,
          date: shift.date,
        })
      }
    }
  }, [now, shifts, personName, confirmedShifts, addAlert])

  const handleConfirm = useCallback(
    (shift: ScheduledShift) => {
      const key = `${shift.date}-${shift.startTime}`
      setConfirmedShifts((prev) => new Set(prev).add(key))
      onConfirmShift(shift.date, shift.startTime)
    },
    [onConfirmShift],
  )

  // Determine which shifts to show alerts for
  const myShifts = shifts.filter((s) => s.personName === personName)

  const alertableShifts = myShifts
    .map((shift) => {
      const key = `${shift.date}-${shift.startTime}`
      const isConfirmed = confirmedShifts.has(key)

      // Build shift start Date for comparison
      const [y, mo, d] = shift.date.split("-").map(Number)
      const [hours, minutes] = shift.startTime.split(":").map(Number)
      const shiftStart = new Date(y, mo - 1, d, hours, minutes, 0, 0)
      const hasStarted = now.getTime() >= shiftStart.getTime()

      const showUpcoming = shouldShowUpcomingAlert(shift.date, shift.startTime, now)
      const showStartedNotConfirmed = hasStarted && !isConfirmed

      // Only show if within upcoming window OR started but not confirmed (up to 90 min after start)
      const minutesSinceStart = (now.getTime() - shiftStart.getTime()) / 60_000
      const shouldShow =
        (!isConfirmed && showUpcoming) ||
        (!isConfirmed && showStartedNotConfirmed && minutesSinceStart <= 90)

      return {
        shift,
        key,
        isConfirmed,
        hasStarted,
        showUpcoming,
        shouldShow,
      }
    })
    .filter((item) => item.shouldShow)

  if (alertableShifts.length === 0) return null

  return (
    <div className="space-y-3">
      {alertableShifts.map(({ shift, key, hasStarted }) => (
        <Card
          key={key}
          className={`border-2 ${
            hasStarted
              ? "border-orange-400 bg-gradient-to-r from-orange-50 to-red-50"
              : "border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50"
          }`}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              {hasStarted ? (
                <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0 mt-0.5" />
              ) : (
                <Bell className="h-6 w-6 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      hasStarted
                        ? "bg-orange-100 text-orange-800 border-orange-300"
                        : "bg-blue-100 text-blue-800 border-blue-300"
                    }
                  >
                    {hasStarted ? "Turno en curso" : "Turno próximo"}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                    {to12h(shift.startTime)} – {to12h(shift.endTime)}
                  </span>
                </div>

                <p className="text-base font-medium text-gray-900">
                  {hasStarted
                    ? `Tu turno ya comenzó. Confirma tu asistencia.`
                    : `Tienes un turno programado próximamente.`}
                </p>

                <p className="text-sm text-gray-600">
                  {personName} · {shift.date}
                </p>

                <Button
                  variant="action"
                  onClick={() => handleConfirm(shift)}
                  className="mt-1 w-full sm:w-auto"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Confirmar turno
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
