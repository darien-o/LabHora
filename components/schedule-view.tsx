"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ChevronLeft, ChevronRight, CalendarDays, RefreshCw,
  Plus, AlertTriangle, Clock, Trash2, UserCheck, Check,
} from "lucide-react"
import { fetchSchedule, postScheduleShift } from "@/lib/api-client"

interface Person { id: string; name: string }
interface Shift {
  rowIndex: number
  date: string
  personName: string
  startTime: string
  endTime: string
}
interface ScheduleViewProps {
  people: Person[]
  currentPersonName?: string
}

const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

const QUICK_SLOTS = [
  { label: "Mañana", sub: "6:00 AM – 12:00 PM", start: "06:00", end: "12:00" },
  { label: "Tarde", sub: "12:00 PM – 6:00 PM", start: "12:00", end: "18:00" },
  { label: "Noche", sub: "6:00 PM – 10:00 PM", start: "18:00", end: "22:00" },
]

function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const p = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, "0")} ${p}`
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function fmtISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getWeekDates(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d })
}

export function ScheduleView({ people, currentPersonName }: ScheduleViewProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add shift flow
  const [addingForDate, setAddingForDate] = useState<string | null>(null)
  const [addStep, setAddStep] = useState<"slot" | "custom">("slot")
  const [customStart, setCustomStart] = useState("08:00")
  const [customEnd, setCustomEnd] = useState("17:00")

  // Alert
  const [alertMsg, setAlertMsg] = useState("")

  // View/delete shift
  const [viewShift, setViewShift] = useState<Shift | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const weekStartISO = fmtISO(weekStart)

  const personName = currentPersonName || ""

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

  const getShiftsForDay = (dateISO: string) => shifts.filter((s) => s.date === dateISO)

  const isToday = (date: Date) => {
    const t = new Date()
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear()
  }

  const handleTapDay = (dateISO: string) => {
    if (!personName) {
      setAlertMsg("Primero debes seleccionar tu perfil en la pantalla principal para poder asignar turnos.")
      return
    }
    setAddingForDate(dateISO)
    setAddStep("slot")
  }

  const handleQuickSlot = async (slot: typeof QUICK_SLOTS[0]) => {
    if (!addingForDate || !personName) return
    await saveShift(addingForDate, slot.start, slot.end)
  }

  const handleCustomSave = async () => {
    if (!addingForDate || !personName) return
    if (customStart >= customEnd) {
      setAlertMsg("La hora de fin debe ser después de la hora de inicio.")
      return
    }
    await saveShift(addingForDate, customStart, customEnd)
  }

  const saveShift = async (date: string, start: string, end: string) => {
    // Check overlap with own shifts
    const dayShifts = getShiftsForDay(date).filter((s) => s.personName === personName)
    const overlap = dayShifts.some((s) => start < s.endTime && end > s.startTime)
    if (overlap) {
      setAlertMsg("Ya tienes un turno en ese horario. Elimina el anterior primero o elige otro horario.")
      return
    }

    setSaving(true)
    try {
      await postScheduleShift({
        action: "add",
        date,
        personName,
        startTime: start,
        endTime: end,
      })
      // Optimistic update
      setShifts((prev) => [...prev, {
        rowIndex: Date.now(),
        date,
        personName,
        startTime: start,
        endTime: end,
      }])
      setAddingForDate(null)
      // Reload to get real rowIndex
      setTimeout(() => { loadShifts() }, 1500)
    } catch (e: any) {
      console.error("Error saving shift:", e)
      setAlertMsg("Error al guardar el turno. Intenta de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  const removeShift = async (shift: Shift) => {
    setSaving(true)
    setViewShift(null)
    try {
      await postScheduleShift({ action: "remove", rowIndex: shift.rowIndex })
      setShifts((prev) => prev.filter((s) => s.rowIndex !== shift.rowIndex))
    } catch (e) {
      console.error("Error removing shift:", e)
      setAlertMsg("Error al eliminar el turno.")
    } finally { setSaving(false) }
  }

  const weekEndDate = new Date(weekStart); weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekLabel = `${weekStart.getDate()} ${weekStart.toLocaleDateString("es-ES", { month: "short" })} – ${weekEndDate.getDate()} ${weekEndDate.toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`

  const addingDateObj = addingForDate ? new Date(addingForDate + "T12:00:00") : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarDays className="h-6 w-6" />
              Turnos de la Semana
            </CardTitle>
            <Button variant="outline" onClick={loadShifts} disabled={loading} className="h-11 w-11 p-0">
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Week navigator */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <Button variant="ghost" onClick={goToPrevWeek} className="h-12 w-12 p-0">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <button onClick={goToCurrentWeek} className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
              {weekLabel}
            </button>
            <Button variant="ghost" onClick={goToNextWeek} className="h-12 w-12 p-0">
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          {personName && (
            <div className="p-3 bg-blue-50 rounded-xl flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <span className="text-base text-blue-900 font-medium">
                Asignando turnos para: <strong>{personName}</strong>
              </span>
            </div>
          )}

          {!personName && (
            <div className="p-4 bg-orange-50 rounded-xl flex items-center gap-3 border border-orange-200">
              <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0" />
              <p className="text-base text-orange-900">
                Selecciona tu perfil en la pantalla principal para poder asignar turnos.
              </p>
            </div>
          )}

          <p className="text-sm text-gray-600">
            Toca un día para agregar tu turno. Puedes elegir mañana, tarde, noche o un horario personalizado.
          </p>
        </CardContent>
      </Card>

      {/* Days list */}
      <div className="space-y-3">
        {weekDates.map((date, dayIdx) => {
          const dateISO = fmtISO(date)
          const today = isToday(date)
          const dayShifts = getShiftsForDay(dateISO)
          const myShifts = dayShifts.filter((s) => s.personName === personName)
          const otherShifts = dayShifts.filter((s) => s.personName !== personName)

          return (
            <Card
              key={dateISO}
              className={`overflow-hidden ${today ? "ring-2 ring-blue-400 border-blue-300" : ""}`}
            >
              <CardContent className="p-4 space-y-3">
                {/* Day header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${today ? "text-blue-600" : "text-gray-900"}`}>
                      {DAY_NAMES_FULL[dayIdx]}
                    </span>
                    <span className="text-base text-gray-600">
                      {date.getDate()}/{date.getMonth() + 1}
                    </span>
                    {today && <Badge className="bg-blue-100 text-blue-700 text-xs px-2">Hoy</Badge>}
                  </div>
                  {personName && (
                    <Button
                      variant="outline"
                      onClick={() => handleTapDay(dateISO)}
                      disabled={saving}
                      className="h-10 px-3 text-sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  )}
                </div>

                {/* My shifts */}
                {myShifts.length > 0 && (
                  <div className="space-y-2">
                    {myShifts.map((s) => (
                      <button
                        key={s.rowIndex}
                        onClick={() => setViewShift(s)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 border-2 border-blue-200 hover:border-blue-400 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="font-semibold text-base text-blue-900">{s.personName}</span>
                        </div>
                        <span className="font-mono text-base text-blue-800 font-medium">
                          {to12h(s.startTime)} – {to12h(s.endTime)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Other people's shifts */}
                {otherShifts.length > 0 && (
                  <div className="space-y-2">
                    {otherShifts.map((s) => (
                      <div
                        key={s.rowIndex}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                          <span className="font-medium text-base text-gray-700">{s.personName}</span>
                        </div>
                        <span className="font-mono text-sm text-gray-600">
                          {to12h(s.startTime)} – {to12h(s.endTime)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {dayShifts.length === 0 && (
                  <p className="text-sm text-gray-500 italic">Sin turnos asignados</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add Shift Dialog — step 1: quick slots */}
      <Dialog open={!!addingForDate} onOpenChange={(open) => { if (!open) setAddingForDate(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="h-6 w-6 text-blue-600" />
              Agregar Turno
            </DialogTitle>
            <DialogDescription className="text-base">
              {addingDateObj && (
                <span className="text-gray-700">
                  <strong>{personName}</strong> — {addingDateObj.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {addStep === "slot" && (
            <div className="space-y-4 py-2">
              <p className="text-base text-gray-700 font-medium">Elige un horario:</p>
              <div className="space-y-3">
                {QUICK_SLOTS.map((slot) => (
                  <Button
                    key={slot.label}
                    variant="outline"
                    onClick={() => handleQuickSlot(slot)}
                    disabled={saving}
                    className="w-full h-16 flex items-center justify-between px-5 text-left rounded-xl border-2 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <div>
                      <span className="text-lg font-semibold text-gray-900 block">{slot.label}</span>
                      <span className="text-sm text-gray-600">{slot.sub}</span>
                    </div>
                    {saving ? <RefreshCw className="h-5 w-5 animate-spin text-gray-400" /> : <Clock className="h-5 w-5 text-gray-400" />}
                  </Button>
                ))}
              </div>

              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  onClick={() => setAddStep("custom")}
                  className="w-full h-12 text-base text-blue-600 hover:text-blue-700"
                >
                  Elegir horario personalizado...
                </Button>
              </div>
            </div>
          )}

          {addStep === "custom" && (
            <div className="space-y-4 py-2">
              <p className="text-base text-gray-700 font-medium">Horario personalizado:</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Hora inicio</Label>
                  <Input
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-500 mt-1 block">{to12h(customStart)}</span>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Hora fin</Label>
                  <Input
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-500 mt-1 block">{to12h(customEnd)}</span>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddStep("slot")} className="h-12 text-base">
                  Volver
                </Button>
                <Button onClick={handleCustomSave} disabled={saving} className="h-12 text-base bg-blue-600 hover:bg-blue-700">
                  {saving ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
                  Guardar Turno
                </Button>
              </DialogFooter>
            </div>
          )}

          {addStep === "slot" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddingForDate(null)} className="h-12 text-base">
                Cancelar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* View/Remove Shift Dialog */}
      <Dialog open={!!viewShift} onOpenChange={(open) => { if (!open) setViewShift(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Clock className="h-6 w-6 text-blue-600" />
              Detalle del Turno
            </DialogTitle>
          </DialogHeader>
          {viewShift && (
            <div className="space-y-5 py-2">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="font-bold text-lg text-blue-900">{viewShift.personName}</p>
                <p className="text-base text-gray-700 mt-1">
                  {new Date(viewShift.date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 py-3">
                <div className="text-center">
                  <p className="text-sm text-gray-600 font-medium">Entrada</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">{to12h(viewShift.startTime)}</p>
                </div>
                <span className="text-gray-300 text-2xl">→</span>
                <div className="text-center">
                  <p className="text-sm text-gray-600 font-medium">Salida</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">{to12h(viewShift.endTime)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setViewShift(null)} className="h-12 text-base">
              Cerrar
            </Button>
            {viewShift && viewShift.personName === personName && (
              <Button
                variant="destructive"
                onClick={() => viewShift && removeShift(viewShift)}
                disabled={saving}
                className="h-12 text-base"
              >
                {saving ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
                Eliminar turno
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert */}
      <AlertDialog open={!!alertMsg} onOpenChange={() => setAlertMsg("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Aviso</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-700">
              {alertMsg}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="h-12 text-base px-8">Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
