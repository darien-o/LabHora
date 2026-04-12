"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  ChevronLeft, ChevronRight, CalendarDays, RefreshCw,
  Plus, X, UserCheck, AlertTriangle, Clock, Pencil, Trash2,
} from "lucide-react"
import { fetchSchedule, postScheduleShift } from "@/lib/api-client"

interface Person { id: string; name: string }

interface Shift {
  rowIndex: number
  date: string
  personName: string
  startTime: string // HH:mm
  endTime: string   // HH:mm
}

interface ScheduleViewProps { people: Person[] }

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

// Visual guide slots (6 AM – 10 PM, 2h blocks) — used for the grid layout
const GUIDE_SLOTS = [
  { start: "06:00", end: "08:00" },
  { start: "08:00", end: "10:00" },
  { start: "10:00", end: "12:00" },
  { start: "12:00", end: "14:00" },
  { start: "14:00", end: "16:00" },
  { start: "16:00", end: "18:00" },
  { start: "18:00", end: "20:00" },
  { start: "20:00", end: "22:00" },
]

const PERSON_COLORS = [
  { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", dot: "bg-blue-500" },
  { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-800", dot: "bg-emerald-500" },
  { bg: "bg-violet-100", border: "border-violet-300", text: "text-violet-800", dot: "bg-violet-500" },
  { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-800", dot: "bg-amber-500" },
  { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-800", dot: "bg-rose-500" },
  { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-800", dot: "bg-cyan-500" },
  { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", dot: "bg-orange-500" },
  { bg: "bg-pink-100", border: "border-pink-300", text: "text-pink-800", dot: "bg-pink-500" },
]

// --- Helpers ---

function to12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`
}

function timeRange12h(start: string, end: string): string {
  return `${to12h(start)} – ${to12h(end)}`
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** Check if a shift overlaps a guide slot visually */
function shiftOverlapsSlot(shift: Shift, slot: typeof GUIDE_SLOTS[0]): boolean {
  return shift.startTime < slot.end && shift.endTime > slot.start
}

export function ScheduleView({ people }: ScheduleViewProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<string>("")

  // Dialog state for adding/editing a shift
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogDate, setDialogDate] = useState("")
  const [dialogStart, setDialogStart] = useState("06:00")
  const [dialogEnd, setDialogEnd] = useState("08:00")
  const [dialogError, setDialogError] = useState("")

  // Dialog for viewing/removing an existing shift
  const [viewShift, setViewShift] = useState<Shift | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const weekStartISO = formatDateISO(weekStart)

  const personColorMap = useMemo(() => {
    const map: Record<string, typeof PERSON_COLORS[0]> = {}
    people.forEach((p, i) => { map[p.name] = PERSON_COLORS[i % PERSON_COLORS.length] })
    return map
  }, [people])

  const loadShifts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSchedule(weekStartISO)
      if (!data.error) setShifts(data)
    } catch (e) { console.error("Error loading schedule:", e) }
    finally { setLoading(false) }
  }, [weekStartISO])

  useEffect(() => { loadShifts() }, [loadShifts])

  const goToPrevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const goToNextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const goToCurrentWeek = () => setWeekStart(getWeekStart(new Date()))

  // Get shifts for a specific day
  const getShiftsForDay = (dateISO: string) => shifts.filter((s) => s.date === dateISO)

  // Get the shift that covers a specific slot on a day
  const getShiftForSlot = (dateISO: string, slot: typeof GUIDE_SLOTS[0]): Shift | null => {
    return shifts.find((s) => s.date === dateISO && shiftOverlapsSlot(s, slot)) || null
  }

  // Open dialog to add a new shift
  const openAddDialog = (dateISO: string, slot: typeof GUIDE_SLOTS[0]) => {
    if (!selectedPerson) return
    setDialogDate(dateISO)
    setDialogStart(slot.start)
    setDialogEnd(slot.end)
    setDialogError("")
    setDialogOpen(true)
  }

  // Confirm adding a shift from dialog
  const confirmAddShift = async () => {
    if (dialogStart >= dialogEnd) {
      setDialogError("La hora de fin debe ser después de la hora de inicio")
      return
    }
    // Check overlap with existing shifts for same person on same day
    const dayShifts = getShiftsForDay(dialogDate).filter((s) => s.personName === selectedPerson)
    const hasOverlap = dayShifts.some((s) => dialogStart < s.endTime && dialogEnd > s.startTime)
    if (hasOverlap) {
      setDialogError("Este horario se cruza con otro turno de la misma persona")
      return
    }

    setSaving(true)
    setDialogOpen(false)
    try {
      await postScheduleShift({
        action: "add",
        date: dialogDate,
        personName: selectedPerson,
        startTime: dialogStart,
        endTime: dialogEnd,
      })
      // Optimistically add to local state immediately
      const tempShift: Shift = {
        rowIndex: Date.now(), // temporary rowIndex until reload
        date: dialogDate,
        personName: selectedPerson,
        startTime: dialogStart,
        endTime: dialogEnd,
      }
      setShifts((prev) => [...prev, tempShift])
      // Reload after a short delay to get the real rowIndex from the sheet
      setTimeout(() => { loadShifts() }, 1500)
    } catch (e) { console.error("Error adding shift:", e) }
    finally { setSaving(false) }
  }

  // Remove a shift
  const removeShift = async (shift: Shift) => {
    setSaving(true)
    setViewShift(null)
    try {
      await postScheduleShift({ action: "remove", rowIndex: shift.rowIndex })
      setShifts((prev) => prev.filter((s) => s.rowIndex !== shift.rowIndex))
    } catch (e) { console.error("Error removing shift:", e) }
    finally { setSaving(false) }
  }

  const isToday = (date: Date) => {
    const t = new Date(); return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear()
  }
  const isPast = (date: Date) => { const t = new Date(); t.setHours(0, 0, 0, 0); return date < t }

  // Stats
  const totalSlots = 7 * GUIDE_SLOTS.length
  const coveredSlots = GUIDE_SLOTS.reduce((count, slot) => {
    return count + weekDates.filter((d) => getShiftForSlot(formatDateISO(d), slot)).length
  }, 0)
  const unassignedSlots = totalSlots - coveredSlots
  const coveragePercent = totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 0

  const weekEndDate = new Date(weekStart); weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekLabel = `${weekStart.getDate()} ${weekStart.toLocaleDateString("es-ES", { month: "short" })} – ${weekEndDate.getDate()} ${weekEndDate.toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Turnos de la Semana
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadShifts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Week navigator */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
            <Button variant="ghost" size="sm" onClick={goToPrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
            <button onClick={goToCurrentWeek} className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">
              {weekLabel}
            </button>
            <Button variant="ghost" size="sm" onClick={goToNextWeek}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          {/* Coverage */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Cobertura semanal</span>
              <span>{coveragePercent}% ({coveredSlots}/{totalSlots} bloques)</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${coveragePercent === 100 ? "bg-emerald-500" : coveragePercent > 50 ? "bg-blue-500" : "bg-orange-500"}`}
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
          </div>

          {/* Person selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              <UserCheck className="h-3.5 w-3.5 inline mr-1" />
              Asignar turno a:
            </label>
            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
              <SelectTrigger><SelectValue placeholder="Selecciona un cuidador..." /></SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${personColorMap[p.name]?.dot || "bg-gray-400"}`} />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedPerson && <p className="text-xs text-gray-500 mt-1">Selecciona un cuidador para asignar bloques</p>}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {people.map((p) => {
              const c = personColorMap[p.name]
              const count = shifts.filter((s) => s.personName === p.name).length
              if (!count) return null
              return (
                <Badge key={p.name} variant="outline" className={`${c?.bg} ${c?.border} ${c?.text} text-[10px]`}>
                  <div className={`w-2 h-2 rounded-full ${c?.dot} mr-1`} />{p.name} ({count})
                </Badge>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Grid */}
      <div className="space-y-2">
        {weekDates.map((date, dayIdx) => {
          const dateISO = formatDateISO(date)
          const today = isToday(date)
          const past = isPast(date)
          const dayShifts = getShiftsForDay(dateISO)
          const slotsWithoutShift = GUIDE_SLOTS.filter((slot) => !getShiftForSlot(dateISO, slot)).length

          return (
            <Card key={dateISO} className={`overflow-hidden ${today ? "ring-2 ring-blue-400 border-blue-300" : past ? "opacity-60" : ""}`}>
              <CardContent className="p-3">
                {/* Day header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${today ? "text-blue-600" : "text-gray-800"}`}>{DAY_NAMES[dayIdx]}</span>
                    <span className="text-sm text-gray-500">{date.getDate()}/{date.getMonth() + 1}</span>
                    {today && <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0">Hoy</Badge>}
                  </div>
                  {slotsWithoutShift > 0 && !past && (
                    <span className="flex items-center gap-1 text-[10px] text-orange-600">
                      <AlertTriangle className="h-3 w-3" />{slotsWithoutShift} sin asignar
                    </span>
                  )}
                  {slotsWithoutShift === 0 && <span className="text-[10px] text-emerald-600">✓ Completo</span>}
                </div>

                {/* Time slots grid */}
                <div className="grid grid-cols-4 gap-1">
                  {GUIDE_SLOTS.map((slot) => {
                    const shift = getShiftForSlot(dateISO, slot)
                    const colors = shift ? personColorMap[shift.personName] : null
                    const isEmpty = !shift
                    const canAdd = isEmpty && selectedPerson && !saving

                    if (shift) {
                      return (
                        <button
                          key={slot.start}
                          onClick={() => setViewShift(shift)}
                          className={`relative rounded-md p-1.5 text-center transition-all min-h-[48px] border ${colors?.bg} ${colors?.border} ${colors?.text} hover:opacity-80`}
                          title={`${shift.personName}: ${timeRange12h(shift.startTime, shift.endTime)}`}
                        >
                          <span className="text-[9px] font-semibold block leading-tight">
                            {to12h(shift.startTime).replace(":00 ", "")}
                          </span>
                          <span className="text-[9px] block leading-tight opacity-70">
                            {to12h(shift.endTime).replace(":00 ", "")}
                          </span>
                          <span className="text-[8px] block truncate leading-tight mt-0.5 font-medium">
                            {shift.personName.split(" ")[0]}
                          </span>
                        </button>
                      )
                    }

                    return (
                      <button
                        key={slot.start}
                        disabled={!canAdd}
                        onClick={() => openAddDialog(dateISO, slot)}
                        className={`rounded-md p-1.5 text-center transition-all min-h-[48px] ${
                          canAdd
                            ? "bg-gray-50 border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                            : "bg-gray-50 border border-dashed border-gray-200 cursor-default"
                        }`}
                        title={canAdd ? `Asignar ${selectedPerson}` : `${to12h(slot.start)} – ${to12h(slot.end)}`}
                      >
                        <span className="text-[9px] text-gray-400 block leading-tight">
                          {to12h(slot.start).replace(":00 ", "")}
                        </span>
                        <span className="text-[9px] text-gray-400 block leading-tight">
                          {to12h(slot.end).replace(":00 ", "")}
                        </span>
                        {canAdd && <Plus className="h-3 w-3 mx-auto mt-0.5 text-gray-400" />}
                      </button>
                    )
                  })}
                </div>

                {/* Custom shifts that don't align with guide slots — show as list below */}
                {dayShifts.filter((s) => {
                  // Show shifts that don't perfectly match any guide slot
                  return !GUIDE_SLOTS.some((g) => g.start === s.startTime && g.end === s.endTime)
                }).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                    {dayShifts
                      .filter((s) => !GUIDE_SLOTS.some((g) => g.start === s.startTime && g.end === s.endTime))
                      .map((s) => {
                        const c = personColorMap[s.personName]
                        return (
                          <button
                            key={s.rowIndex}
                            onClick={() => setViewShift(s)}
                            className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs border ${c?.bg} ${c?.border} ${c?.text} hover:opacity-80 transition-all`}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${c?.dot}`} />
                              <span className="font-medium">{s.personName}</span>
                            </div>
                            <span className="font-mono text-[10px]">{timeRange12h(s.startTime, s.endTime)}</span>
                          </button>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary cards */}
      {unassignedSlots > 0 && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">
                {unassignedSlots} bloque{unassignedSlots !== 1 ? "s" : ""} sin asignar esta semana
              </span>
            </div>
            <p className="text-xs text-orange-600 mt-1">Selecciona un cuidador y toca los bloques vacíos para asignarlos</p>
          </CardContent>
        </Card>
      )}
      {unassignedSlots === 0 && shifts.length > 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Semana completamente cubierta</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Shift Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Asignar Turno
            </DialogTitle>
            <DialogDescription>
              {selectedPerson && (
                <span className="flex items-center gap-1.5 mt-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${personColorMap[selectedPerson]?.dot}`} />
                  <span className="font-medium">{selectedPerson}</span>
                  <span className="text-gray-400">·</span>
                  <span>{dialogDate && new Date(dialogDate + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="shift-start" className="text-xs text-gray-600">Hora inicio</Label>
                <Input
                  id="shift-start"
                  type="time"
                  value={dialogStart}
                  onChange={(e) => { setDialogStart(e.target.value); setDialogError("") }}
                  className="mt-1"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">{to12h(dialogStart)}</span>
              </div>
              <div>
                <Label htmlFor="shift-end" className="text-xs text-gray-600">Hora fin</Label>
                <Input
                  id="shift-end"
                  type="time"
                  value={dialogEnd}
                  onChange={(e) => { setDialogEnd(e.target.value); setDialogError("") }}
                  className="mt-1"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">{to12h(dialogEnd)}</span>
              </div>
            </div>
            {dialogError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{dialogError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={confirmAddShift} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Remove Shift Dialog */}
      <Dialog open={!!viewShift} onOpenChange={(open) => { if (!open) setViewShift(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Detalle del Turno
            </DialogTitle>
          </DialogHeader>
          {viewShift && (() => {
            const c = personColorMap[viewShift.personName]
            return (
              <div className="space-y-4 py-2">
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${c?.bg} ${c?.border}`}>
                  <div className={`w-3 h-3 rounded-full ${c?.dot}`} />
                  <div>
                    <p className={`font-semibold ${c?.text}`}>{viewShift.personName}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(viewShift.date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Entrada</p>
                    <p className="text-lg font-mono font-semibold">{to12h(viewShift.startTime)}</p>
                  </div>
                  <span className="text-gray-300 text-lg">→</span>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Salida</p>
                    <p className="text-lg font-mono font-semibold">{to12h(viewShift.endTime)}</p>
                  </div>
                </div>
              </div>
            )
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewShift(null)}>Cerrar</Button>
            <Button variant="destructive" size="sm" onClick={() => viewShift && removeShift(viewShift)} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Eliminar turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
