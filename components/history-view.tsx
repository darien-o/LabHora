"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  RefreshCw, Clock, Calendar, User, AlertCircle, DollarSign,
  Moon, Sun, PartyPopper, ChevronLeft, ChevronRight, Check,
  Filter, CircleDollarSign, Pencil, Trash2,
} from "lucide-react"
import { calculatePaySummary, formatCOP, type PaySummary } from "@/lib/colombian-labor"
import { fetchPeople, fetchTimeEntries, postTogglePaid, postEditEntry, postDeleteEntry } from "@/lib/api-client"
import { useAdmin } from "@/lib/admin-context"

interface TimeEntry {
  id: string; rowIndex: number; personName: string; clockIn: string;
  clockOut?: string; totalHours?: number; paid: boolean; date: string;
}
interface Person { id: string; name: string }
type DateFilterMode = "month" | "range" | "all"

interface HistoryViewProps {
  timeEntries: TimeEntry[]
  people: Person[]
  onRefresh: () => void
  currentPersonName?: string
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function HistoryView({ timeEntries, people, onRefresh, currentPersonName }: HistoryViewProps) {
  const { isAdmin } = useAdmin()
  const [selectedPerson, setSelectedPerson] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [localPeople, setLocalPeople] = useState<Person[]>([])
  const [localEntries, setLocalEntries] = useState<TimeEntry[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("month")
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [rangeFrom, setRangeFrom] = useState("")
  const [rangeTo, setRangeTo] = useState("")

  // Edit dialog
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [editDate, setEditDate] = useState("")
  const [editClockIn, setEditClockIn] = useState("")
  const [editClockOut, setEditClockOut] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")

  // Delete confirm
  const [deleteEntry, setDeleteEntry] = useState<TimeEntry | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  useEffect(() => { loadFreshData() }, [])
  useEffect(() => { setLocalPeople(people); setLocalEntries(timeEntries) }, [people, timeEntries])

  const loadFreshData = async () => {
    setLoading(true)
    try {
      const [pd, ed] = await Promise.all([fetchPeople(), fetchTimeEntries()])
      if (!pd.error) setLocalPeople(pd)
      if (!ed.error) setLocalEntries(ed)
    } catch {} finally { setLoading(false) }
  }

  const parseSpanishDateTime = useCallback((s: string): Date => {
    try {
      const [d, t] = s.split(", ")
      const [day, mo, yr] = d.split("/")
      const [h, m, sec] = t.split(":")
      return new Date(+yr, +mo - 1, +day, +h, +m, +(sec || "0"))
    } catch { return new Date() }
  }, [])

  const personFiltered = useMemo(() => {
    if (selectedPerson === "all") return localEntries
    return localEntries.filter((e) => e.personName === selectedPerson)
  }, [localEntries, selectedPerson])

  const filteredEntries = useMemo(() => {
    return personFiltered.filter((entry) => {
      const d = parseSpanishDateTime(entry.clockIn)
      if (dateFilterMode === "month") return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
      if (dateFilterMode === "range" && rangeFrom && rangeTo) {
        return d >= new Date(rangeFrom + "T00:00:00") && d <= new Date(rangeTo + "T23:59:59")
      }
      return true
    })
  }, [personFiltered, dateFilterMode, selectedMonth, selectedYear, rangeFrom, rangeTo, parseSpanishDateTime])

  const totalHours = useMemo(() => filteredEntries.reduce((t, e) => t + (e.totalHours || 0), 0), [filteredEntries])

  const paySummary: PaySummary | null = useMemo(() => {
    if (selectedPerson === "all") return null
    const completed = filteredEntries.filter((e) => e.clockIn && e.clockOut)
      .map((e) => ({ clockIn: parseSpanishDateTime(e.clockIn), clockOut: parseSpanishDateTime(e.clockOut!) }))
    if (!completed.length) return null
    return calculatePaySummary(completed)
  }, [filteredEntries, selectedPerson, parseSpanishDateTime])

  const paidSummary = useMemo(() => {
    const completed = filteredEntries.filter((e) => e.clockOut)
    const paid = completed.filter((e) => e.paid)
    const unpaid = completed.filter((e) => !e.paid)
    return {
      paidCount: paid.length, unpaidCount: unpaid.length,
      paidHours: paid.reduce((t, e) => t + (e.totalHours || 0), 0),
      unpaidHours: unpaid.reduce((t, e) => t + (e.totalHours || 0), 0),
    }
  }, [filteredEntries])

  const fmtDT = (s: string) => {
    try {
      const d = parseSpanishDateTime(s)
      return { date: d.toLocaleDateString("es-ES"), time: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) }
    } catch { return { date: "?", time: "?" } }
  }
  const fmtH = (h: number) => { const hr = Math.floor(h); const m = Math.round((h - hr) * 60); return `${hr}h ${m}m` }

  const handleRefresh = async () => { setLoading(true); try { await loadFreshData(); await onRefresh() } finally { setLoading(false) } }

  const handleTogglePaid = async (entry: TimeEntry) => {
    setTogglingId(entry.id)
    try { await postTogglePaid(entry.rowIndex, !entry.paid); setLocalEntries((p) => p.map((e) => e.id === entry.id ? { ...e, paid: !entry.paid } : e)) }
    catch {} finally { setTogglingId(null) }
  }

  // Permission check: can this user edit/delete this entry?
  const canModify = (entry: TimeEntry): boolean => {
    if (entry.paid) return false // paid entries are locked
    if (!entry.clockOut) return false // active entries can't be edited here
    if (isAdmin) return true // admin can edit any unpaid
    // Regular user: only own entries from today or yesterday
    if (entry.personName !== currentPersonName) return false
    const entryDate = parseSpanishDateTime(entry.clockIn)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const entryDay = new Date(entryDate); entryDay.setHours(0, 0, 0, 0)
    return entryDay >= yesterday
  }

  const openEdit = (entry: TimeEntry) => {
    const cin = parseSpanishDateTime(entry.clockIn)
    const cout = entry.clockOut ? parseSpanishDateTime(entry.clockOut) : new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    setEditEntry(entry)
    setEditDate(`${cin.getFullYear()}-${pad(cin.getMonth() + 1)}-${pad(cin.getDate())}`)
    setEditClockIn(`${pad(cin.getHours())}:${pad(cin.getMinutes())}`)
    setEditClockOut(`${pad(cout.getHours())}:${pad(cout.getMinutes())}`)
    setEditError("")
  }

  const handleEditSave = async () => {
    if (!editEntry || !editDate || !editClockIn || !editClockOut) return
    const cin = new Date(`${editDate}T${editClockIn}`)
    const cout = new Date(`${editDate}T${editClockOut}`)
    if (cin >= cout) { setEditError("La hora de salida debe ser posterior a la de entrada."); return }
    setEditSaving(true); setEditError("")
    try {
      await postEditEntry(editEntry.rowIndex, cin.toISOString(), cout.toISOString())
      setEditEntry(null)
      await loadFreshData()
      await onRefresh()
    } catch (e: any) { setEditError(e.message || "Error al guardar.") }
    finally { setEditSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteEntry) return
    setDeleteSaving(true)
    try {
      await postDeleteEntry(deleteEntry.rowIndex)
      setDeleteEntry(null)
      await loadFreshData()
      await onRefresh()
    } catch {} finally { setDeleteSaving(false) }
  }

  const goToPrevMonth = () => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1) } else setSelectedMonth((m) => m - 1) }
  const goToNextMonth = () => { if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1) } else setSelectedMonth((m) => m + 1) }
  const goToCurrentMonth = () => { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()) }

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      try { return parseSpanishDateTime(b.clockIn).getTime() - parseSpanishDateTime(a.clockIn).getTime() } catch { return 0 }
    })
  }, [filteredEntries, parseSpanishDateTime])

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2"><Calendar className="h-6 w-6" />Historial de Registros</CardTitle>
            <Button variant="outline" onClick={handleRefresh} disabled={loading} className="h-11 w-11 p-0">
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-base font-semibold text-gray-800 mb-2 block">Filtrar por cuidador:</label>
            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
              <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Seleccionar cuidador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-base py-3">Todos los cuidadores</SelectItem>
                {localPeople.map((p) => <SelectItem key={p.id} value={p.name} className="text-base py-3">{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-base font-semibold text-gray-800 mb-2 block"><Filter className="h-4 w-4 inline mr-1" />Filtrar por fecha:</label>
            <div className="flex gap-2">
              {(["month", "range", "all"] as DateFilterMode[]).map((mode) => (
                <Button key={mode} variant={dateFilterMode === mode ? "default" : "outline"} onClick={() => setDateFilterMode(mode)} className="flex-1 h-12 text-base font-medium">
                  {mode === "month" ? "Mes" : mode === "range" ? "Rango" : "Todo"}
                </Button>
              ))}
            </div>
          </div>
          {dateFilterMode === "month" && (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
              <Button variant="ghost" onClick={goToPrevMonth} className="h-11 w-11 p-0"><ChevronLeft className="h-6 w-6" /></Button>
              <button onClick={goToCurrentMonth} className="text-lg font-bold text-gray-900 hover:text-blue-600">{MONTH_NAMES[selectedMonth]} {selectedYear}</button>
              <Button variant="ghost" onClick={goToNextMonth} className="h-11 w-11 p-0"><ChevronRight className="h-6 w-6" /></Button>
            </div>
          )}
          {dateFilterMode === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Desde:</label><Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Hasta:</label><Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></div>
            </div>
          )}
          {selectedPerson !== "all" && (
            <div className="p-5 bg-blue-50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><User className="h-5 w-5 text-blue-600" /><span className="font-semibold text-lg text-blue-900">{selectedPerson}</span></div>
                <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-600" /><span className="font-bold text-lg text-blue-900">{fmtH(totalHours)}</span></div>
              </div>
              <p className="text-base text-blue-700">{filteredEntries.length} registro{filteredEntries.length !== 1 ? "s" : ""}</p>
              {(paidSummary.paidCount > 0 || paidSummary.unpaidCount > 0) && (
                <div className="flex gap-4 pt-1">
                  {paidSummary.paidCount > 0 && <span className="text-sm flex items-center gap-1.5 text-green-800 font-medium"><Check className="h-4 w-4" />{paidSummary.paidCount} pagado{paidSummary.paidCount !== 1 ? "s" : ""} ({fmtH(paidSummary.paidHours)})</span>}
                  {paidSummary.unpaidCount > 0 && <span className="text-sm flex items-center gap-1.5 text-orange-800 font-medium"><CircleDollarSign className="h-4 w-4" />{paidSummary.unpaidCount} pendiente{paidSummary.unpaidCount !== 1 ? "s" : ""} ({fmtH(paidSummary.unpaidHours)})</span>}
                </div>
              )}
            </div>
          )}
          {/* Pay breakdown */}
          {selectedPerson !== "all" && paySummary && paySummary.totalHours > 0 && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
                  {isAdmin ? <DollarSign className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  {isAdmin ? "Liquidación según Ley Laboral Colombiana" : "Desglose de Horas por Tipo"}
                </CardTitle>
                {isAdmin && <p className="text-sm text-emerald-700">SMLMV 2026: {formatCOP(paySummary.monthlyMinWage)} · Valor hora: {formatCOP(Math.round(paySummary.hourlyRate))}</p>}
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <div className="space-y-3">
                  {paySummary.hourBreakdown.regularDay > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Sun className="h-5 w-5 text-yellow-600" /><span className="text-gray-800">Diurnas ordinarias</span><span className="text-sm text-gray-600">({fmtH(paySummary.hourBreakdown.regularDay)})</span></div>{isAdmin && <span className="font-semibold text-gray-900">{formatCOP(paySummary.regularDayPay)}</span>}</div>}
                  {paySummary.hourBreakdown.regularNight > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Moon className="h-5 w-5 text-indigo-600" /><span className="text-gray-800">Nocturnas +35%</span><span className="text-sm text-gray-600">({fmtH(paySummary.hourBreakdown.regularNight)})</span></div>{isAdmin && <span className="font-semibold text-gray-900">{formatCOP(paySummary.regularNightPay)}</span>}</div>}
                  {paySummary.hourBreakdown.sundayHolidayDay > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><PartyPopper className="h-5 w-5 text-orange-600" /><span className="text-gray-800">Dom/Festivo diurno</span><span className="text-sm text-gray-600">({fmtH(paySummary.hourBreakdown.sundayHolidayDay)})</span></div>{isAdmin && <span className="font-semibold text-gray-900">{formatCOP(paySummary.sundayHolidayDayPay)}</span>}</div>}
                  {paySummary.hourBreakdown.sundayHolidayNight > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Moon className="h-5 w-5 text-purple-600" /><span className="text-gray-800">Dom/Festivo nocturno</span><span className="text-sm text-gray-600">({fmtH(paySummary.hourBreakdown.sundayHolidayNight)})</span></div>{isAdmin && <span className="font-semibold text-gray-900">{formatCOP(paySummary.sundayHolidayNightPay)}</span>}</div>}
                </div>
                {isAdmin && (<><div className="pt-3 border-t border-emerald-200"><div className="flex items-center justify-between"><span className="font-bold text-lg text-emerald-900">Total a pagar</span><span className="font-bold text-xl text-emerald-700">{formatCOP(paySummary.totalPay)}</span></div></div><p className="text-xs text-emerald-700 leading-relaxed">* Cálculo basado en salario mínimo 2026 y Ley 2466/2025.</p></>)}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Records List */}
      <div className="space-y-4">
        {loading && localEntries.length === 0 ? (
          <Card><CardContent className="pt-6"><div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
            <p className="text-base text-gray-700 mt-3">Cargando registros...</p>
          </div></CardContent></Card>
        ) : sortedEntries.length === 0 ? (
          <Card><CardContent className="pt-6"><div className="text-center py-10">
            <Calendar className="h-14 w-14 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-700">No hay registros para mostrar</p>
            <p className="text-base text-gray-500 mt-2">
              {dateFilterMode === "month" ? `No hay registros en ${MONTH_NAMES[selectedMonth]} ${selectedYear}` : "No se encontraron registros"}
            </p>
          </div></CardContent></Card>
        ) : (
          sortedEntries.map((entry) => {
            const cin = fmtDT(entry.clockIn)
            const cout = entry.clockOut ? fmtDT(entry.clockOut) : null
            const isActive = !entry.clockOut
            const isToggling = togglingId === entry.id
            const editable = canModify(entry)
            const isMine = entry.personName === currentPersonName

            return (
              <Card key={entry.id} className={isActive ? "border-green-200 bg-green-50" : entry.paid ? "border-emerald-200 bg-emerald-50/30" : ""}>
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-4 h-4 rounded-full bg-blue-500" />
                        <span className="font-semibold text-lg text-gray-900">{entry.personName}</span>
                        {isMine && <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Tú</Badge>}
                        {isActive && <Badge className="bg-green-100 text-green-800 text-sm px-2">Activo</Badge>}
                        {!isActive && entry.paid && <Badge className="bg-emerald-100 text-emerald-700 text-xs px-2">Pagado</Badge>}
                        {!isActive && !entry.paid && <Badge variant="outline" className="text-orange-700 border-orange-400 text-xs px-2">Pendiente</Badge>}
                      </div>
                      <span className="text-base text-gray-600 font-medium">{cin.date}</span>
                    </div>

                    {/* Times */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600 uppercase tracking-wide font-medium">Entrada</p>
                        <p className="font-mono text-xl font-bold text-gray-900">{cin.time}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600 uppercase tracking-wide font-medium">Salida</p>
                        <p className="font-mono text-xl font-bold text-gray-900">{cout ? cout.time : "En curso..."}</p>
                      </div>
                    </div>

                    {/* Total hours */}
                    {entry.totalHours !== undefined && (
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-base text-gray-700">Tiempo total:</span>
                          <span className="font-bold text-lg text-blue-600">{fmtH(entry.totalHours)}</span>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {/* Edit button */}
                      {editable && (
                        <Button variant="outline" onClick={() => openEdit(entry)} className="flex-1 h-11 text-sm font-medium">
                          <Pencil className="h-4 w-4 mr-1.5" />Editar
                        </Button>
                      )}
                      {/* Delete button */}
                      {editable && (
                        <Button variant="outline" onClick={() => setDeleteEntry(entry)} className="h-11 text-sm font-medium text-red-600 border-red-300 hover:bg-red-50">
                          <Trash2 className="h-4 w-4 mr-1.5" />Eliminar
                        </Button>
                      )}
                      {/* Paid toggle — admin only */}
                      {!isActive && isAdmin && (
                        <Button
                          variant={entry.paid ? "outline" : "default"}
                          className={`flex-1 h-11 text-sm font-medium ${entry.paid ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "bg-orange-500 hover:bg-orange-600 text-white"}`}
                          disabled={isToggling}
                          onClick={() => handleTogglePaid(entry)}
                        >
                          {isToggling ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : entry.paid ? <Check className="h-4 w-4 mr-1.5" /> : <CircleDollarSign className="h-4 w-4 mr-1.5" />}
                          {entry.paid ? "Pagado ✓" : "Marcar pagado"}
                        </Button>
                      )}
                    </div>

                    {/* Info text for non-editable */}
                    {!editable && !isActive && !entry.paid && isMine && (
                      <p className="text-xs text-gray-500 italic">Solo puedes editar registros de hoy o ayer.</p>
                    )}
                    {!editable && entry.paid && isMine && (
                      <p className="text-xs text-gray-500 italic">Este registro ya fue pagado y no se puede modificar.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Total summary */}
      {filteredEntries.length > 0 && (
        <Card className="bg-gray-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-lg text-gray-800">Total general:</span>
              <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-gray-700" /><span className="font-bold text-xl text-gray-900">{fmtH(totalHours)}</span></div>
            </div>
            <p className="text-base text-gray-600 mt-1">{filteredEntries.length} registro{filteredEntries.length !== 1 ? "s" : ""} en total</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2"><Pencil className="h-6 w-6 text-blue-600" />Editar Registro</DialogTitle>
            <DialogDescription className="text-base">
              {editEntry && <span className="text-gray-700">Editando registro de <strong>{editEntry.personName}</strong></span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium text-gray-700">Fecha</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Hora entrada</Label>
                <Input type="time" value={editClockIn} onChange={(e) => { setEditClockIn(e.target.value); setEditError("") }} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Hora salida</Label>
                <Input type="time" value={editClockOut} onChange={(e) => { setEditClockOut(e.target.value); setEditError("") }} className="mt-1" />
              </div>
            </div>
            {editError && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />{editError}</p>}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditEntry(null)} className="h-12 text-base">Cancelar</Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="h-12 text-base bg-blue-600 hover:bg-blue-700">
              {editSaving ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => { if (!open) setDeleteEntry(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-700">
              {deleteEntry && (
                <>Se eliminará el registro de <strong>{deleteEntry.personName}</strong> del {fmtDT(deleteEntry.clockIn).date}. Esta acción no se puede deshacer.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-12 text-base">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteSaving} className="h-12 text-base bg-red-600 hover:bg-red-700">
              {deleteSaving ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
