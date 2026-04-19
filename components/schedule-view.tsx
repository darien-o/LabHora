"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Plus, AlertTriangle, Clock, Trash2, UserCheck, Check, Eye,
  Ban, ShieldAlert, Repeat, CalendarRange,
} from "lucide-react"
import { fetchSchedule, postScheduleShift, fetchBlocks, postScheduleRepeat, postHistoricalEntry } from "@/lib/api-client"
import { getWeekStartMonday, checkBlockConflicts, type ScheduleBlock } from "@/lib/schedule-utils"
import { ShiftDayPicker } from "@/components/shift-day-picker"
import { RepeatShiftConfig } from "@/components/repeat-shift-config"
import { BlockScheduleDialog } from "@/components/block-schedule-dialog"
import { MultiDayRegistration } from "@/components/multi-day-registration"
import { useAdmin } from "@/lib/admin-context"

interface Person { id: string; name: string }
interface Shift {
  rowIndex: number; date: string; personName: string;
  startTime: string; endTime: string;
}
interface ScheduleViewProps {
  people: Person[]
  currentPersonName?: string
}

// Task 9.1: Week starts on Monday — order is Lunes→Domingo
const DAY_NAMES_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const PERSON_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-900", dot: "bg-blue-500", ring: "ring-blue-400" },
  { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-900", dot: "bg-emerald-500", ring: "ring-emerald-400" },
  { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-900", dot: "bg-violet-500", ring: "ring-violet-400" },
  { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900", dot: "bg-amber-500", ring: "ring-amber-400" },
  { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-900", dot: "bg-rose-500", ring: "ring-rose-400" },
  { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-900", dot: "bg-cyan-500", ring: "ring-cyan-400" },
  { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-900", dot: "bg-orange-500", ring: "ring-orange-400" },
  { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-900", dot: "bg-pink-500", ring: "ring-pink-400" },
]

function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const p = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, "0")} ${p}`
}
function fmtISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
function getWeekDates(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d })
}

export function ScheduleView({ people, currentPersonName }: ScheduleViewProps) {
  const { isAdmin } = useAdmin()

  // Task 9.1: Use getWeekStartMonday instead of getWeekStart
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(new Date()))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alertMsg, setAlertMsg] = useState("")
  const [viewShift, setViewShift] = useState<Shift | null>(null)

  // Task 9.3: ShiftDayPicker dialog state
  const [showAddShiftDialog, setShowAddShiftDialog] = useState(false)

  // Task 9.4: RepeatShiftConfig state — shown after a shift is created
  const [repeatShiftData, setRepeatShiftData] = useState<{
    date: string; startTime: string; endTime: string
  } | null>(null)

  // Task 9.5: Blocks state
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [showBlockDialog, setShowBlockDialog] = useState(false)

  // Multi-day registration dialog
  const [showMultiDayDialog, setShowMultiDayDialog] = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const weekStartISO = fmtISO(weekStart)
  const personName = currentPersonName || ""

  // Build a color map for all people
  const colorMap = useMemo(() => {
    const map: Record<string, typeof PERSON_COLORS[0]> = {}
    people.forEach((p, i) => { map[p.name] = PERSON_COLORS[i % PERSON_COLORS.length] })
    shifts.forEach((s) => {
      if (!map[s.personName]) {
        const idx = Object.keys(map).length
        map[s.personName] = PERSON_COLORS[idx % PERSON_COLORS.length]
      }
    })
    return map
  }, [people, shifts])

  const loadShifts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSchedule(weekStartISO)
      if (!data.error) setShifts(data)
    } catch (e) { console.error("Error loading schedule:", e) }
    finally { setLoading(false) }
  }, [weekStartISO])

  // Task 9.5: Load blocks alongside shifts
  const loadBlocks = useCallback(async () => {
    try {
      const data = await fetchBlocks(weekStartISO)
      if (!data.error) setBlocks(Array.isArray(data) ? data : [])
    } catch (e) { console.error("Error loading blocks:", e) }
  }, [weekStartISO])

  useEffect(() => { loadShifts(); loadBlocks() }, [loadShifts, loadBlocks])

  const goToPrevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const goToNextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  // Task 9.1: Use getWeekStartMonday for "go to current week"
  const goToCurrentWeek = () => setWeekStart(getWeekStartMonday(new Date()))

  const getShiftsForDay = (dateISO: string) => shifts.filter((s) => s.date === dateISO)

  const isToday = (date: Date) => {
    const t = new Date()
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear()
  }

  // Task 9.5: Check if a day has blocks for the current person
  const getBlocksForDay = useCallback((dateISO: string): ScheduleBlock[] => {
    return blocks.filter((b) => {
      if (dateISO < b.startDate || dateISO > b.endDate) return false
      return true
    })
  }, [blocks])

  // Task 9.3: Open ShiftDayPicker dialog
  const handleOpenAddShift = () => {
    if (!personName) {
      setAlertMsg("Primero debes seleccionar tu perfil en la pantalla principal para poder asignar turnos.")
      return
    }
    setShowAddShiftDialog(true)
  }

  // Task 9.3 + 9.5: Handle shift selected from ShiftDayPicker
  const handleShiftSelected = async (date: string, startTime: string, endTime: string) => {
    if (!personName) return

    // Task 9.5: Check block conflicts before saving
    const blockConflict = checkBlockConflicts(personName, date, startTime, endTime, blocks)
    if (blockConflict) {
      const reason = blockConflict.reason ? ` Motivo: ${blockConflict.reason}` : ""
      setAlertMsg(
        `No se puede crear el turno. ${personName} tiene un bloqueo de horario del ${blockConflict.startDate} al ${blockConflict.endDate}.${reason}`
      )
      return
    }

    // Check for overlaps with own shifts
    const dayShifts = getShiftsForDay(date)
    const myOverlap = dayShifts
      .filter((s) => s.personName === personName)
      .some((s) => startTime < s.endTime && endTime > s.startTime)
    if (myOverlap) {
      setAlertMsg("Ya tienes un turno en ese horario. Elimina el anterior primero o elige otro horario.")
      return
    }

    // Warn about overlaps with others
    const otherOverlaps = dayShifts
      .filter((s) => s.personName !== personName && startTime < s.endTime && endTime > s.startTime)
    if (otherOverlaps.length > 0) {
      const names = [...new Set(otherOverlaps.map((s) => s.personName))].join(", ")
      setAlertMsg(`Nota: ${names} también tiene turno en ese horario. Se guardará tu turno de todas formas.`)
    }

    setSaving(true)
    try {
      await postScheduleShift({ action: "add", date, personName, startTime, endTime })
      setShifts((prev) => [...prev, { rowIndex: Date.now(), date, personName, startTime, endTime }])
      setShowAddShiftDialog(false)

      // Task 9.4: After saving, offer to make it repeating
      setRepeatShiftData({ date, startTime, endTime })

      setTimeout(() => { loadShifts() }, 1500)
    } catch (e: any) {
      setAlertMsg(e.message || "Error al guardar el turno.")
    } finally { setSaving(false) }
  }

  // Task 9.4: Handle repeat shift confirmation
  const handleRepeatConfirm = async (data: { frequency: "daily" | "weekly"; endDate: string }) => {
    if (!repeatShiftData || !personName) return
    setSaving(true)
    try {
      await postScheduleRepeat({
        personName,
        date: repeatShiftData.date,
        startTime: repeatShiftData.startTime,
        endTime: repeatShiftData.endTime,
        frequency: data.frequency,
        endDate: data.endDate,
      })
      setRepeatShiftData(null)
      loadShifts()
    } catch (e: any) {
      setAlertMsg(e.message || "Error al crear turno repetitivo.")
    } finally { setSaving(false) }
  }

  const removeShift = async (shift: Shift) => {
    setSaving(true); setViewShift(null)
    try {
      await postScheduleShift({ action: "remove", rowIndex: shift.rowIndex })
      setShifts((prev) => prev.filter((s) => s.rowIndex !== shift.rowIndex))
    } catch { setAlertMsg("Error al eliminar el turno.") }
    finally { setSaving(false) }
  }

  const handleMultiDayConfirm = async (records: Array<{ date: string; startTime: string; endTime: string }>) => {
    if (!personName) return
    setSaving(true)
    try {
      for (const record of records) {
        const [y, mo, d] = record.date.split("-").map(Number)
        const [sh, sm] = record.startTime.split(":").map(Number)
        const [eh, em] = record.endTime.split(":").map(Number)
        const clockIn = new Date(y, mo - 1, d, sh, sm, 0, 0).toISOString()
        const clockOut = new Date(y, mo - 1, d, eh, em, 0, 0).toISOString()
        await postHistoricalEntry(personName, clockIn, clockOut)
      }
      setShowMultiDayDialog(false)
      setAlertMsg(`Registro multi-día completado: ${records.length} días registrados para ${personName}.`)
      loadShifts()
    } catch (e: any) {
      setAlertMsg(e.message || "Error al crear registro multi-día.")
    } finally { setSaving(false) }
  }

  // Unique people who have shifts this week
  const activeNames = useMemo(() => {
    const names = new Set(shifts.map((s) => s.personName))
    return [...names]
  }, [shifts])

  // Task 9.1: Week label shows Monday–Sunday range
  const weekEndDate = new Date(weekStart); weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekLabel = `${weekStart.getDate()} ${weekStart.toLocaleDateString("es-ES", { month: "short" })} – ${weekEndDate.getDate()} ${weekEndDate.toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarDays className="h-6 w-6" />
              Turnos de la Semana
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Multi-day registration button */}
              {personName && (
                <Button
                  variant="outline"
                  onClick={() => setShowMultiDayDialog(true)}
                  className="h-11 px-3 text-sm"
                >
                  <CalendarRange className="h-4 w-4 mr-1" />
                  Multi-Día
                </Button>
              )}
              {/* Task 9.5: Admin-only button to create blocks */}
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setShowBlockDialog(true)}
                  className="h-11 px-3 text-sm"
                >
                  <Ban className="h-4 w-4 mr-1" />
                  Bloquear
                </Button>
              )}
              <Button variant="outline" onClick={() => { loadShifts(); loadBlocks() }} disabled={loading} className="h-11 w-11 p-0">
                <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Task 9.2: Navigation buttons with outline variant, border, contrasting background, adequate touch size */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <Button variant="outline" onClick={goToPrevWeek} className="h-12 w-12 p-0 border-2 bg-white hover:bg-gray-100">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <button onClick={goToCurrentWeek} className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">{weekLabel}</button>
            <Button variant="outline" onClick={goToNextWeek} className="h-12 w-12 p-0 border-2 bg-white hover:bg-gray-100">
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          {personName && (
            <div className="p-3 bg-blue-50 rounded-xl flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <span className="text-base text-blue-900 font-medium">
                Tus turnos: <strong>{personName}</strong>
              </span>
            </div>
          )}

          {!personName && (
            <div className="p-4 bg-orange-50 rounded-xl flex items-center gap-3 border border-orange-200">
              <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0" />
              <p className="text-base text-orange-900">Selecciona tu perfil en la pantalla principal para asignar turnos.</p>
            </div>
          )}

          {/* Color legend */}
          {activeNames.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> Cuidadores con turnos esta semana:
              </p>
              <div className="flex flex-wrap gap-2">
                {activeNames.map((name) => {
                  const c = colorMap[name]
                  const count = shifts.filter((s) => s.personName === name).length
                  const isMe = name === personName
                  return (
                    <Badge
                      key={name}
                      variant="outline"
                      className={`text-sm px-3 py-1 ${c?.bg} ${c?.border} ${c?.text} ${isMe ? "ring-2 " + c?.ring + " font-bold" : ""}`}
                    >
                      <div className={`w-3 h-3 rounded-full ${c?.dot} mr-1.5 shrink-0`} />
                      {name} ({count})
                      {isMe && <span className="ml-1 text-xs">(tú)</span>}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {/* Task 9.3: Updated instruction text */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Toca <strong>Agregar Turno</strong> para asignar un turno. Toca un turno existente para ver detalles.
            </p>
            {/* Task 9.3: Single "Agregar Turno" button that opens ShiftDayPicker */}
            {personName && (
              <Button variant="action" onClick={handleOpenAddShift} disabled={saving} className="h-10 px-3 text-sm shrink-0 ml-2">
                <Plus className="h-4 w-4 mr-1" />Agregar Turno
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Days list */}
      <div className="space-y-3">
        {weekDates.map((date, dayIdx) => {
          const dateISO = fmtISO(date)
          const today = isToday(date)
          const dayShifts = getShiftsForDay(dateISO)
          const sorted = [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime))

          // Task 9.5: Check for blocks on this day
          const dayBlocks = getBlocksForDay(dateISO)
          const hasBlocks = dayBlocks.length > 0

          return (
            <Card key={dateISO} className={`overflow-hidden ${today ? "ring-2 ring-blue-400 border-blue-300" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Task 9.1: DAY_NAMES_FULL[dayIdx] now maps correctly Mon→Sun */}
                    <span className={`text-lg font-bold ${today ? "text-blue-600" : "text-gray-900"}`}>{DAY_NAMES_FULL[dayIdx]}</span>
                    <span className="text-base text-gray-600">{date.getDate()}/{date.getMonth() + 1}</span>
                    {today && <Badge className="bg-blue-100 text-blue-700 text-xs px-2">Hoy</Badge>}
                    {/* Task 9.5: Block indicator */}
                    {hasBlocks && (
                      <Badge variant="outline" className="bg-red-50 border-red-300 text-red-700 text-xs px-2">
                        <Ban className="h-3 w-3 mr-1" />Bloqueado
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Task 9.5: Show block details */}
                {hasBlocks && (
                  <div className="space-y-1">
                    {dayBlocks.map((block, bIdx) => (
                      <div key={`block-${bIdx}`} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-sm">
                        <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="text-red-800">
                          <strong>{block.personName}</strong>
                          {block.startTime && block.endTime
                            ? ` — ${to12h(block.startTime)} a ${to12h(block.endTime)}`
                            : " — Todo el día"}
                          {block.reason && <span className="text-red-600 ml-1">({block.reason})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* All shifts for this day, color-coded */}
                {sorted.length > 0 ? (
                  <div className="space-y-2">
                    {sorted.map((s) => {
                      const c = colorMap[s.personName] || PERSON_COLORS[0]
                      const isMe = s.personName === personName
                      return (
                        <button
                          key={s.rowIndex}
                          onClick={() => setViewShift(s)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${c.bg} ${c.border} ${isMe ? "ring-1 " + c.ring + " shadow-sm" : "opacity-90"} hover:opacity-100 hover:shadow-md`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full ${c.dot} shrink-0`} />
                            <div>
                              <span className={`font-semibold text-base ${c.text}`}>
                                {s.personName}
                                {isMe && <span className="text-sm font-normal ml-1">(tú)</span>}
                              </span>
                            </div>
                          </div>
                          <span className={`font-mono text-base font-medium ${c.text}`}>
                            {to12h(s.startTime)} – {to12h(s.endTime)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-base text-gray-400 italic py-2">Sin turnos asignados</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Task 9.3: Add Shift Dialog with ShiftDayPicker */}
      <Dialog open={showAddShiftDialog} onOpenChange={setShowAddShiftDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="h-6 w-6 text-blue-600" />Agregar Turno
            </DialogTitle>
            <DialogDescription className="text-base">
              <span className="text-gray-700">
                <strong>{personName}</strong> — Selecciona día y horario
              </span>
            </DialogDescription>
          </DialogHeader>

          <ShiftDayPicker
            weekStart={weekStart}
            onShiftSelected={handleShiftSelected}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShiftDialog(false)} className="h-12 text-base">
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task 9.4: Repeat Shift Dialog — shown after creating a shift */}
      <Dialog open={!!repeatShiftData} onOpenChange={(open) => { if (!open) setRepeatShiftData(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Repeat className="h-6 w-6 text-blue-600" />Hacer Repetitivo
            </DialogTitle>
            <DialogDescription className="text-base text-gray-700">
              ¿Quieres que este turno se repita automáticamente?
            </DialogDescription>
          </DialogHeader>

          {repeatShiftData && (
            <RepeatShiftConfig
              personName={personName}
              date={repeatShiftData.date}
              startTime={repeatShiftData.startTime}
              endTime={repeatShiftData.endTime}
              onConfirm={handleRepeatConfirm}
              onCancel={() => setRepeatShiftData(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Shift Dialog — read-only for others, delete for own */}
      <Dialog open={!!viewShift} onOpenChange={(open) => { if (!open) setViewShift(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Clock className="h-6 w-6 text-blue-600" />Detalle del Turno
            </DialogTitle>
          </DialogHeader>
          {viewShift && (() => {
            const c = colorMap[viewShift.personName] || PERSON_COLORS[0]
            const isMe = viewShift.personName === personName
            return (
              <div className="space-y-5 py-2">
                <div className={`p-4 rounded-xl border-2 ${c.bg} ${c.border}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full ${c.dot}`} />
                    <div>
                      <p className={`font-bold text-lg ${c.text}`}>
                        {viewShift.personName}
                        {isMe && <span className="text-sm font-normal ml-2">(tú)</span>}
                      </p>
                      <p className="text-base text-gray-700 mt-0.5">
                        {new Date(viewShift.date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                    </div>
                  </div>
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
                {!isMe && (
                  <p className="text-sm text-gray-500 text-center italic">
                    Solo puedes eliminar tus propios turnos.
                  </p>
                )}
              </div>
            )
          })()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setViewShift(null)} className="h-12 text-base">Cerrar</Button>
            {viewShift && viewShift.personName === personName && (
              <Button variant="destructive" onClick={() => viewShift && removeShift(viewShift)} disabled={saving} className="h-12 text-base">
                {saving ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
                Eliminar mi turno
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task 9.5: Block Schedule Dialog (admin only) */}
      <BlockScheduleDialog
        people={people.map((p) => ({ name: p.name }))}
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        onBlockCreated={() => { loadBlocks(); loadShifts() }}
      />

      {/* Multi-Day Registration Dialog */}
      <Dialog open={showMultiDayDialog} onOpenChange={setShowMultiDayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <CalendarRange className="h-6 w-6 text-blue-600" />Registro Multi-Día
            </DialogTitle>
            <DialogDescription className="text-base text-gray-700">
              Registra turnos continuos de varios días para <strong>{personName}</strong>
            </DialogDescription>
          </DialogHeader>

          <MultiDayRegistration
            personName={personName}
            onConfirm={handleMultiDayConfirm}
            onCancel={() => setShowMultiDayDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!alertMsg} onOpenChange={() => setAlertMsg("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Aviso</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-700">{alertMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="h-12 text-base px-8">Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
