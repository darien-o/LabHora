"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalendarDays, Check, X, AlertTriangle } from "lucide-react"
import { generateMultiDayRecords, type DayRecord } from "@/lib/schedule-utils"
import { useAdmin } from "@/lib/admin-context"

interface MultiDayRegistrationProps {
  personName: string
  onConfirm: (records: Array<{ date: string; startTime: string; endTime: string }>) => void
  onCancel: () => void
}

/** Formats "YYYY-MM-DD" → "DD/MM/YYYY" for display. */
function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

/** Calculates approximate hours from HH:mm start to HH:mm end within a single day. */
function hoursForRecord(record: DayRecord): number {
  const [sh, sm] = record.startTime.split(":").map(Number)
  const [eh, em] = record.endTime.split(":").map(Number)
  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em
  return Math.max(0, (endMinutes - startMinutes) / 60)
}

export function MultiDayRegistration({
  personName,
  onConfirm,
  onCancel,
}: MultiDayRegistrationProps) {
  const { addAlert } = useAdmin()

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [startTime, setStartTime] = useState("08:00")
  const [endTime, setEndTime] = useState("17:00")

  const isValid = endDate >= startDate

  const records = useMemo(() => {
    if (!isValid) return []
    return generateMultiDayRecords({ startDate, endDate, startTime, endTime })
  }, [startDate, endDate, startTime, endTime, isValid])

  const totalHours = useMemo(() => {
    return records.reduce((sum, r) => sum + hoursForRecord(r), 0)
  }, [records])

  const handleConfirm = () => {
    if (!isValid || records.length === 0) return

    // Generate administrative alert with caregiver name, dates, and total hours
    addAlert({
      type: "multi-day",
      message: `Registro multi-día: ${personName} — ${formatDateDisplay(startDate)} al ${formatDateDisplay(endDate)} (${records.length} días, ${totalHours.toFixed(1)} horas)`,
      personName,
      date: startDate,
    })

    onConfirm(records)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-semibold text-gray-800">
          Registro Multi-Día
        </h3>
        <span className="text-sm text-gray-500">— {personName}</span>
      </div>

      {/* Date inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-700">
            Fecha de inicio
          </Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-700">
            Fecha de fin
          </Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Time inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-700">
            Hora inicio (primer día)
          </Label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-700">
            Hora fin (último día)
          </Label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Validation error */}
      {!isValid && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          La fecha de fin debe ser posterior o igual a la fecha de inicio
        </div>
      )}

      {/* Preview / Summary */}
      {isValid && records.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">
            Resumen del registro
          </p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
              <span className="block text-2xl font-bold text-blue-700">
                {records.length}
              </span>
              <span className="text-gray-500">
                {records.length === 1 ? "día" : "días"}
              </span>
            </div>
            <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
              <span className="block text-2xl font-bold text-blue-700">
                {totalHours.toFixed(1)}
              </span>
              <span className="text-gray-500">horas totales</span>
            </div>
          </div>

          {/* Individual records preview */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {records.map((r) => (
              <div
                key={r.date}
                className="flex items-center justify-between rounded-md bg-white px-3 py-1.5 text-sm shadow-sm"
              >
                <span className="font-medium text-gray-700">
                  {formatDateDisplay(r.date)}
                </span>
                <span className="text-gray-500">
                  {r.startTime} – {r.endTime}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          onClick={onCancel}
          className="h-11 flex-1"
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button
          variant="action"
          onClick={handleConfirm}
          disabled={!isValid || records.length === 0}
          className="h-11 flex-1 max-w-none"
        >
          <Check className="h-4 w-4 mr-1" />
          Confirmar Registro
        </Button>
      </div>
    </div>
  )
}
