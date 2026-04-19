"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, ChevronLeft, Clock, Sun, Moon, Sunset, CalendarDays } from "lucide-react"
import { getWeekStartMonday } from "@/lib/schedule-utils"

interface ShiftDayPickerProps {
  weekStart: Date
  onShiftSelected: (date: string, startTime: string, endTime: string) => void
}

type Step = "day" | "type" | "labor" | "custom"

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const LABOR_SHIFTS = [
  { label: "Mañana", sub: "06:00 – 14:00", start: "06:00", end: "14:00", icon: Sun },
  { label: "Tarde", sub: "14:00 – 22:00", start: "14:00", end: "22:00", icon: Sunset },
  { label: "Noche", sub: "22:00 – 06:00", start: "22:00", end: "06:00", icon: Moon },
]

function fmtISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isToday(date: Date): boolean {
  const t = new Date()
  return (
    date.getDate() === t.getDate() &&
    date.getMonth() === t.getMonth() &&
    date.getFullYear() === t.getFullYear()
  )
}

export function ShiftDayPicker({ weekStart, onShiftSelected }: ShiftDayPickerProps) {
  const [step, setStep] = useState<Step>("day")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [customStart, setCustomStart] = useState("08:00")
  const [customEnd, setCustomEnd] = useState("17:00")

  const weekDates = useMemo(() => {
    const monday = getWeekStartMonday(weekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return null
    return weekDates.find((d) => fmtISO(d) === selectedDate) ?? null
  }, [selectedDate, weekDates])

  const selectedDayLabel = useMemo(() => {
    if (!selectedDateObj) return ""
    const idx = weekDates.indexOf(selectedDateObj)
    return `${DAY_NAMES[idx]} ${selectedDateObj.getDate()}/${selectedDateObj.getMonth() + 1}`
  }, [selectedDateObj, weekDates])

  const handleDaySelect = (date: Date) => {
    setSelectedDate(fmtISO(date))
    setStep("type")
  }

  const handleFullDay = () => {
    if (selectedDate) {
      onShiftSelected(selectedDate, "00:00", "23:59")
    }
  }

  const handleLaborShift = (shift: (typeof LABOR_SHIFTS)[0]) => {
    if (selectedDate) {
      onShiftSelected(selectedDate, shift.start, shift.end)
    }
  }

  const handleCustomSave = () => {
    if (selectedDate) {
      onShiftSelected(selectedDate, customStart, customEnd)
    }
  }

  const goBack = () => {
    if (step === "labor" || step === "custom") {
      setStep("type")
    } else if (step === "type") {
      setStep("day")
      setSelectedDate(null)
    }
  }

  // ── Step 1: Day selection ──
  if (step === "day") {
    return (
      <div className="space-y-3">
        <p className="text-base font-medium text-gray-700 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600" />
          Selecciona un día
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {weekDates.map((date, idx) => {
            const today = isToday(date)
            return (
              <Button
                key={fmtISO(date)}
                variant="outline"
                onClick={() => handleDaySelect(date)}
                className={`h-16 flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 transition-all ${
                  today
                    ? "border-blue-400 bg-blue-50 hover:bg-blue-100"
                    : "hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                <span className={`text-base font-semibold ${today ? "text-blue-700" : "text-gray-900"}`}>
                  {DAY_NAMES[idx]}
                </span>
                <span className={`text-sm ${today ? "text-blue-600" : "text-gray-500"}`}>
                  {date.getDate()}/{date.getMonth() + 1}
                </span>
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Step 2: Shift type selection ──
  if (step === "type") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={goBack} className="h-9 w-9 p-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-base font-medium text-gray-700">
            {selectedDayLabel} — Tipo de turno
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={handleFullDay}
            className="w-full h-16 flex items-center justify-between px-5 rounded-xl border-2 hover:border-blue-400 hover:bg-blue-50"
          >
            <div className="text-left">
              <span className="text-base font-semibold text-gray-900 block">Día Completo</span>
              <span className="text-sm text-gray-500">00:00 – 23:59</span>
            </div>
            <Clock className="h-5 w-5 text-gray-400" />
          </Button>

          <Button
            variant="outline"
            onClick={() => setStep("labor")}
            className="w-full h-16 flex items-center justify-between px-5 rounded-xl border-2 hover:border-blue-400 hover:bg-blue-50"
          >
            <div className="text-left">
              <span className="text-base font-semibold text-gray-900 block">Turno Laboral</span>
              <span className="text-sm text-gray-500">Mañana / Tarde / Noche</span>
            </div>
            <Sun className="h-5 w-5 text-gray-400" />
          </Button>

          <Button
            variant="outline"
            onClick={() => setStep("custom")}
            className="w-full h-16 flex items-center justify-between px-5 rounded-xl border-2 hover:border-blue-400 hover:bg-blue-50"
          >
            <div className="text-left">
              <span className="text-base font-semibold text-gray-900 block">Horario Personalizado</span>
              <span className="text-sm text-gray-500">Define hora de inicio y fin</span>
            </div>
            <CalendarDays className="h-5 w-5 text-gray-400" />
          </Button>
        </div>
      </div>
    )
  }

  // ── Step 2b: Labor shift options ──
  if (step === "labor") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={goBack} className="h-9 w-9 p-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-base font-medium text-gray-700">
            {selectedDayLabel} — Turno Laboral
          </p>
        </div>

        <div className="space-y-3">
          {LABOR_SHIFTS.map((shift) => {
            const Icon = shift.icon
            return (
              <Button
                key={shift.label}
                variant="outline"
                onClick={() => handleLaborShift(shift)}
                className="w-full h-16 flex items-center justify-between px-5 rounded-xl border-2 hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-blue-500" />
                  <div className="text-left">
                    <span className="text-base font-semibold text-gray-900 block">{shift.label}</span>
                    <span className="text-sm text-gray-500">{shift.sub}</span>
                  </div>
                </div>
                <Clock className="h-5 w-5 text-gray-400" />
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Step 2c: Custom time ──
  if (step === "custom") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={goBack} className="h-9 w-9 p-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-base font-medium text-gray-700">
            {selectedDayLabel} — Horario Personalizado
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Hora inicio</Label>
            <Input
              type="time"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">Hora fin</Label>
            <Input
              type="time"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={goBack} className="h-11 flex-1">
            Volver
          </Button>
          <Button
            variant="action"
            onClick={handleCustomSave}
            className="h-11 flex-1 max-w-none"
          >
            <Check className="h-5 w-5 mr-1" />
            Guardar Turno
          </Button>
        </div>
      </div>
    )
  }

  return null
}
