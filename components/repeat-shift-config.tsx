"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import {
  Repeat, CalendarDays, Check, X, AlertTriangle,
} from "lucide-react"
import { generateRepeatInstances } from "@/lib/schedule-utils"

interface RepeatShiftConfigProps {
  personName: string
  date: string        // YYYY-MM-DD — the initial shift date
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  onConfirm: (data: { frequency: "daily" | "weekly"; endDate: string }) => void
  onCancel: () => void
}

function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const p = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, "0")} ${p}`
}

function formatDateES(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function RepeatShiftConfig({
  personName,
  date,
  startTime,
  endTime,
  onConfirm,
  onCancel,
}: RepeatShiftConfigProps) {
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly")
  const [endDate, setEndDate] = useState("")

  const isEndDateValid = endDate >= date
  const hasEndDate = endDate.length > 0

  const instances = useMemo(() => {
    if (!hasEndDate || !isEndDateValid) return []
    return generateRepeatInstances(date, endDate, frequency, startTime, endTime)
  }, [date, endDate, frequency, startTime, endTime, hasEndDate, isEndDateValid])

  const handleConfirm = () => {
    if (!hasEndDate || !isEndDateValid) return
    onConfirm({ frequency, endDate })
  }

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="p-3 bg-blue-50 rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <Repeat className="h-5 w-5 text-blue-600" />
          <span className="text-base font-semibold text-blue-900">Turno Repetitivo</span>
        </div>
        <p className="text-sm text-blue-800">
          <strong>{personName}</strong> — {formatDateES(date)}, {to12h(startTime)} – {to12h(endTime)}
        </p>
      </div>

      {/* Frequency selection */}
      <div className="space-y-2">
        <Label className="text-base font-medium text-gray-900">Frecuencia</Label>
        <RadioGroup
          value={frequency}
          onValueChange={(val) => setFrequency(val as "daily" | "weekly")}
          className="grid grid-cols-2 gap-3"
        >
          <label
            htmlFor="freq-daily"
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
              frequency === "daily"
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <RadioGroupItem value="daily" id="freq-daily" />
            <div>
              <span className="text-base font-medium text-gray-900">Diaria</span>
              <p className="text-xs text-gray-500">Todos los días</p>
            </div>
          </label>
          <label
            htmlFor="freq-weekly"
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
              frequency === "weekly"
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <RadioGroupItem value="weekly" id="freq-weekly" />
            <div>
              <span className="text-base font-medium text-gray-900">Semanal</span>
              <p className="text-xs text-gray-500">Mismo día cada semana</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* End date */}
      <div className="space-y-2">
        <Label htmlFor="repeat-end-date" className="text-base font-medium text-gray-900">
          Fecha de fin del período
        </Label>
        <Input
          id="repeat-end-date"
          type="date"
          value={endDate}
          min={date}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-12 text-base"
        />
        {hasEndDate && !isEndDateValid && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            La fecha de fin debe ser igual o posterior a {formatDateES(date)}
          </p>
        )}
      </div>

      {/* Preview of instances */}
      {instances.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium text-gray-900 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Vista previa
            </Label>
            <Badge variant="secondary" className="text-sm">
              {instances.length} {instances.length === 1 ? "turno" : "turnos"}
            </Badge>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
            {instances.map((inst, idx) => (
              <div
                key={inst.date}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-mono w-6 text-right">{idx + 1}.</span>
                  <span className="font-medium text-gray-900">{formatDateES(inst.date)}</span>
                </div>
                <span className="text-gray-600 font-mono">
                  {to12h(inst.startTime)} – {to12h(inst.endTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-12 text-base"
        >
          <X className="h-5 w-5 mr-1" />
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!hasEndDate || !isEndDateValid || instances.length === 0}
          className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
        >
          <Check className="h-5 w-5 mr-1" />
          Confirmar ({instances.length})
        </Button>
      </div>
    </div>
  )
}
