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
  Filter, CircleDollarSign, Pencil, Trash2, Wallet, Scale,
  FileText, ImageIcon, CheckSquare, Banknote, CheckCircle2, Plus,
} from "lucide-react"
import { calculatePaySummary, formatCOP, type PaySummary } from "@/lib/colombian-labor"
import { fetchPeople, fetchTimeEntries, postTogglePaid, postEditEntry, postDeleteEntry, fetchRecaudos, postBulkTogglePaid, fetchAdvances, postAdvance, fetchExpenses } from "@/lib/api-client"
import { useAdmin } from "@/lib/admin-context"
import { calculateSettlement } from "@/lib/settlement-utils"
import { CollapsibleFilters } from "@/components/collapsible-filters"
import { ImageViewerModal } from "@/components/image-viewer-modal"
import { BulkPaymentBar } from "@/components/bulk-payment-bar"
import { PaymentConfirmation } from "@/components/payment-confirmation"
import { AdvancePaymentDialog } from "@/components/advance-payment-dialog"
import { Checkbox } from "@/components/ui/checkbox"

interface TimeEntry {
  id: string; rowIndex: number; personName: string; clockIn: string;
  clockOut?: string; totalHours?: number; paid: boolean; date: string;
  hourlyValue?: number; notes?: string; images?: string;
  confirmedByCaregiver?: string; confirmationDate?: string; amountConfirmed?: number;
}
interface Person { id: string; name: string; isFixed?: boolean; fixedRate?: number | null }
type DateFilterMode = "month" | "range" | "all"
type PayMode = "law" | "custom"

interface Advance {
  rowIndex: number; personName: string; amount: number; date: string;
  month: string; description: string; confirmedByCaregiver: boolean; confirmationDate?: string;
}

interface ShiftExpense {
  rowIndex: number; personName: string; entryRowIndex: number;
  type: "expense" | "income"; amount: number; description: string; date: string;
}

interface Recaudo { rowIndex: number; month: string; amount: number; description: string }

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

  // Pay mode toggle (admin only)
  const [payMode, setPayMode] = useState<PayMode>("custom")
  const [recaudos, setRecaudos] = useState<Recaudo[]>([])

  // Image viewer modal
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerImages, setImageViewerImages] = useState<string[]>([])

  // Bulk selection mode (admin only)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // Advances
  const [advances, setAdvances] = useState<Advance[]>([])
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false)

  // Expenses (gastos)
  const [allExpenses, setAllExpenses] = useState<ShiftExpense[]>([])

  useEffect(() => { loadFreshData() }, [])
  useEffect(() => { setLocalPeople(people); setLocalEntries(timeEntries) }, [people, timeEntries])
  useEffect(() => { if (isAdmin) loadRecaudos() }, [isAdmin])

  const loadFreshData = async () => {
    setLoading(true)
    try {
      const [pd, ed] = await Promise.all([fetchPeople(), fetchTimeEntries()])
      if (!pd.error) setLocalPeople(pd)
      if (!ed.error) setLocalEntries(ed)
      await Promise.all([loadAdvances(), loadAllExpenses()])
    } catch {} finally { setLoading(false) }
  }

  const loadRecaudos = async () => {
    try {
      const data = await fetchRecaudos()
      if (!data.error) setRecaudos(data)
    } catch {}
  }

  const loadAdvances = async () => {
    try {
      const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`
      const data = await fetchAdvances(monthKey)
      if (!data.error) setAdvances(data)
    } catch {}
  }

  const loadAllExpenses = async () => {
    try {
      const data = await fetchExpenses()
      if (!data.error && Array.isArray(data)) setAllExpenses(data)
    } catch {}
  }

  // Load advances when month changes
  useEffect(() => { loadAdvances(); loadAllExpenses() }, [selectedMonth, selectedYear])

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

  // Custom pay calculation based on recaudos
  const customPaySummary = useMemo(() => {
    if (selectedPerson === "all" || !isAdmin) return null
    const completed = filteredEntries.filter((e) => e.clockIn && e.clockOut && e.totalHours)
    if (!completed.length) return null

    const personInfo = localPeople.find((p) => p.name === selectedPerson)
    const isFixed = (personInfo as any)?.isFixed || false
    const fixedRate = (personInfo as any)?.fixedRate || 0

    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`
    const monthRecaudo = recaudos.filter((r) => r.month === monthKey).reduce((t, r) => t + r.amount, 0)
    const totalPersonHours = completed.reduce((t, e) => t + (e.totalHours || 0), 0)

    if (isFixed && fixedRate > 0) {
      return { type: "fixed" as const, hourlyRate: fixedRate, totalHours: totalPersonHours, totalPay: Math.round(totalPersonHours * fixedRate), monthRecaudo }
    }

    if (monthRecaudo <= 0) {
      return { type: "variable" as const, hourlyRate: 0, totalHours: totalPersonHours, totalPay: 0, monthRecaudo: 0, noRecaudo: true }
    }

    const allMonthEntries = localEntries.filter((e) => {
      if (!e.clockIn || !e.clockOut || !e.totalHours) return false
      const d = parseSpanishDateTime(e.clockIn)
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    })

    let fixedCost = 0, variableHours = 0
    for (const e of allMonthEntries) {
      const pi = localPeople.find((p) => p.name === e.personName) as any
      if (pi?.isFixed && pi?.fixedRate && pi.fixedRate > 0) {
        fixedCost += (e.totalHours || 0) * pi.fixedRate
      } else {
        variableHours += (e.totalHours || 0)
      }
    }

    const remaining = Math.max(0, monthRecaudo - fixedCost)
    const variableRate = variableHours > 0 ? Math.round(remaining / variableHours) : 0

    return {
      type: "variable" as const, hourlyRate: variableRate, totalHours: totalPersonHours,
      totalPay: Math.round(totalPersonHours * variableRate), monthRecaudo,
      fixedCost: Math.round(fixedCost), remaining: Math.round(remaining),
      variableHours: Math.round(variableHours * 100) / 100,
    }
  }, [filteredEntries, selectedPerson, localPeople, localEntries, recaudos, selectedMonth, selectedYear, isAdmin, parseSpanishDateTime])

  // Settlement calculation including expenses and advances
  const settlementSummary = useMemo(() => {
    if (selectedPerson === "all" || !customPaySummary || !isAdmin) return null
    if ('noRecaudo' in customPaySummary && customPaySummary.noRecaudo) return null

    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`
    const completed = filteredEntries.filter((e) => e.clockIn && e.clockOut && e.totalHours)

    // Filter expenses for this person in this month's entries
    const entryRowIndices = new Set(completed.map((e) => e.rowIndex))
    const personExpenses = allExpenses.filter(
      (exp) => exp.personName === selectedPerson && entryRowIndices.has(exp.entryRowIndex)
    )

    // Filter advances for this person in this month
    const personAdvances = advances.filter(
      (a) => a.personName === selectedPerson && a.month === monthKey
    )

    if (personExpenses.length === 0 && personAdvances.length === 0) return null

    const result = calculateSettlement(
      completed.map((e) => ({ hours: e.totalHours || 0 })),
      personAdvances.map((a) => ({ amount: a.amount })),
      personExpenses.map((e) => ({ type: e.type, amount: e.amount })),
      customPaySummary.hourlyRate,
    )

    return result
  }, [filteredEntries, selectedPerson, allExpenses, advances, customPaySummary, selectedMonth, selectedYear, isAdmin])

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

  // Bulk selection handlers
  const toggleEntrySelection = (rowIndex: number) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }

  const handleBulkMarkPaid = async () => {
    if (selectedEntries.size === 0) return
    setBulkLoading(true)
    try {
      await postBulkTogglePaid(Array.from(selectedEntries), true)
      setLocalEntries((prev) =>
        prev.map((e) => selectedEntries.has(e.rowIndex) ? { ...e, paid: true } : e)
      )
      setSelectedEntries(new Set())
      setSelectionMode(false)
    } catch {} finally { setBulkLoading(false) }
  }

  const handleBulkMarkAllMonthPaid = async () => {
    const unpaidInMonth = filteredEntries.filter((e) => !e.paid && e.clockOut)
    if (unpaidInMonth.length === 0) return
    const rowIndices = unpaidInMonth.map((e) => e.rowIndex)
    setBulkLoading(true)
    try {
      await postBulkTogglePaid(rowIndices, true)
      setLocalEntries((prev) =>
        prev.map((e) => rowIndices.includes(e.rowIndex) ? { ...e, paid: true } : e)
      )
      setSelectedEntries(new Set())
      setSelectionMode(false)
    } catch {} finally { setBulkLoading(false) }
  }

  const handleCancelSelection = () => {
    setSelectionMode(false)
    setSelectedEntries(new Set())
  }

  // Filtered advances for current view
  const filteredAdvances = useMemo(() => {
    if (dateFilterMode !== "month") return []
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`
    return advances.filter((a) => {
      if (a.month !== monthKey) return false
      if (selectedPerson !== "all" && a.personName !== selectedPerson) return false
      return true
    })
  }, [advances, selectedMonth, selectedYear, selectedPerson, dateFilterMode])

  const handleConfirmAdvance = async (advance: Advance) => {
    try {
      await postAdvance({ action: "edit", rowIndex: advance.rowIndex, personName: advance.personName, amount: advance.amount, date: advance.date, month: advance.month, description: advance.description })
      setAdvances((prev) => prev.map((a) => a.rowIndex === advance.rowIndex ? { ...a, confirmedByCaregiver: true, confirmationDate: new Date().toISOString() } : a))
    } catch {}
  }

  const handlePaymentConfirm = (rowIndex: number, amountReceived?: number) => {
    setLocalEntries((prev) =>
      prev.map((e) =>
        e.rowIndex === rowIndex
          ? { ...e, confirmedByCaregiver: "Sí", confirmationDate: new Date().toLocaleString("es-ES"), amountConfirmed: amountReceived }
          : e
      )
    )
  }

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      try { return parseSpanishDateTime(b.clockIn).getTime() - parseSpanishDateTime(a.clockIn).getTime() } catch { return 0 }
    })
  }, [filteredEntries, parseSpanishDateTime])

  return (
    <div className="space-y-3">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold flex items-center gap-2 text-blue-800"><Calendar className="h-6 w-6" />Historial de Registros</CardTitle>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setAdvanceDialogOpen(true)}
                  className="h-11 px-3 text-sm font-medium text-amber-700 border-amber-300 hover:bg-amber-50"
                  aria-label="Registrar anticipo"
                >
                  <Banknote className="h-5 w-5 mr-1.5" />
                  Anticipo
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  onClick={() => { if (selectionMode) handleCancelSelection(); else setSelectionMode(true) }}
                  className={`h-11 px-3 text-sm font-medium ${selectionMode ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                  aria-label={selectionMode ? "Desactivar selección múltiple" : "Activar selección múltiple"}
                >
                  <CheckSquare className="h-5 w-5 mr-1.5" />
                  {selectionMode ? "Cancelar selección" : "Selección múltiple"}
                </Button>
              )}
              <Button variant="outline" onClick={handleRefresh} disabled={loading} className="h-11 w-11 p-0">
                <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CollapsibleFilters label="Filtros de búsqueda">
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
              <Button variant="outline" onClick={goToPrevMonth} className="h-11 w-11 p-0 border-2 bg-white hover:bg-gray-100"><ChevronLeft className="h-6 w-6" /></Button>
              <button onClick={goToCurrentMonth} className="text-lg font-bold text-gray-900 hover:text-blue-600">{MONTH_NAMES[selectedMonth]} {selectedYear}</button>
              <Button variant="outline" onClick={goToNextMonth} className="h-11 w-11 p-0 border-2 bg-white hover:bg-gray-100"><ChevronRight className="h-6 w-6" /></Button>
            </div>
          )}
          {dateFilterMode === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Desde:</label><Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Hasta:</label><Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></div>
            </div>
          )}
          </CollapsibleFilters>
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
          {/* Pay breakdown — admin toggle between law and custom */}
          {selectedPerson !== "all" && paySummary && paySummary.totalHours > 0 && isAdmin && (
            <div className="space-y-3">
              {/* Toggle */}
              <div className="flex rounded-xl overflow-hidden border-2 border-gray-200">
                <button
                  onClick={() => setPayMode("custom")}
                  className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${payMode === "custom" ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  <Wallet className="h-4 w-4" />
                  Pago Personalizado
                </button>
                <button
                  onClick={() => setPayMode("law")}
                  className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${payMode === "law" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  <Scale className="h-4 w-4" />
                  Ley Colombiana
                </button>
              </div>

              {/* Custom pay view */}
              {payMode === "custom" && customPaySummary && (
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardHeader className="pb-2 pt-5 px-5">
                    <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
                      <Wallet className="h-5 w-5" />
                      Liquidación Personalizada
                    </CardTitle>
                    <p className="text-sm text-emerald-700">
                      {customPaySummary.type === "fixed" ? "Tarifa fija por hora" : "Basado en recaudo del mes"}
                    </p>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-3">
                    {'noRecaudo' in customPaySummary && customPaySummary.noRecaudo ? (
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-800 font-medium">
                          ⚠️ No hay recaudo registrado para {MONTH_NAMES[selectedMonth]} {selectedYear}.
                        </p>
                        <p className="text-xs text-orange-700 mt-1">
                          Agrega un recaudo en el panel de Admin para calcular el valor hora.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-base">
                            <span className="text-gray-700">Horas trabajadas</span>
                            <span className="font-semibold text-gray-900">{fmtH(customPaySummary.totalHours)}</span>
                          </div>
                          <div className="flex items-center justify-between text-base">
                            <span className="text-gray-700">Valor hora</span>
                            <span className="font-semibold text-gray-900">{formatCOP(customPaySummary.hourlyRate)}</span>
                          </div>
                          {customPaySummary.type === "variable" && 'monthRecaudo' in customPaySummary && (
                            <>
                              <div className="pt-2 border-t border-emerald-200 space-y-1.5">
                                <p className="text-xs font-medium text-emerald-800">Cálculo del mes:</p>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">Recaudo del mes</span>
                                  <span className="text-gray-800">{formatCOP(customPaySummary.monthRecaudo)}</span>
                                </div>
                                {'fixedCost' in customPaySummary && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">− Costo cuidadores fijos</span>
                                    <span className="text-red-700">−{formatCOP(customPaySummary.fixedCost as number)}</span>
                                  </div>
                                )}
                                {'remaining' in customPaySummary && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">= Disponible para variables</span>
                                    <span className="text-gray-800">{formatCOP(customPaySummary.remaining as number)}</span>
                                  </div>
                                )}
                                {'variableHours' in customPaySummary && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">÷ Horas variables totales</span>
                                    <span className="text-gray-800">{fmtH(customPaySummary.variableHours as number)}</span>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="pt-3 border-t border-emerald-200">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg text-emerald-900">Total a pagar</span>
                            <span className="font-bold text-xl text-emerald-700">{formatCOP(customPaySummary.totalPay)}</span>
                          </div>
                        </div>

                        {/* Settlement with expenses and advances */}
                        {settlementSummary && (
                          <div className="pt-3 border-t border-emerald-200 space-y-2">
                            <p className="text-xs font-medium text-emerald-800">Ajustes de liquidación:</p>
                            {settlementSummary.totalExpenses > 0 && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">+ Gastos extra</span>
                                <span className="text-red-700">+{formatCOP(settlementSummary.totalExpenses)}</span>
                              </div>
                            )}
                            {settlementSummary.totalIncome > 0 && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">− Dinero recibido</span>
                                <span className="text-green-700">−{formatCOP(settlementSummary.totalIncome)}</span>
                              </div>
                            )}
                            {settlementSummary.totalAdvances > 0 && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">− Anticipos</span>
                                <span className="text-amber-700">−{formatCOP(settlementSummary.totalAdvances)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-2 border-t border-emerald-300">
                              <span className="font-bold text-lg text-emerald-900">Neto a pagar</span>
                              <span className="font-bold text-xl text-emerald-700">{formatCOP(settlementSummary.netPay)}</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Law-based pay view */}
              {payMode === "law" && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2 pt-5 px-5">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                      <Scale className="h-5 w-5" />
                      Liquidación según Ley Laboral Colombiana
                    </CardTitle>
                    <p className="text-sm text-blue-700">SMLMV 2026: {formatCOP(paySummary.monthlyMinWage)} · Valor hora: {formatCOP(Math.round(paySummary.hourlyRate))}</p>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-3">
                    <div className="space-y-3">
                      {paySummary.hourBreakdown.regularDay > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Sun className="h-5 w-5 text-yellow-600" /><span className="text-gray-800">Diurnas ordinarias</span><span className="text-sm text-gray-600">({fmtH(paySummary.hourBreakdown.regularDay)})</span></div><span className="font-semibold text-gray-900">{formatCOP(paySummary.regularDayPay)}</span></div>}
                      {paySummary.hourBreakdown.regularNight > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Moon className="h-5 w-5 text-indigo-600" /><span className="text-gray-800">Nocturnas +35%</span><span className="text-sm text-gray-600">({fmtH(paySummary.hourBreakdown.regularNight)})</span></div><span className="font-semibold text-gray-900">{formatCOP(paySummary.regularNightPay)}</span></div>}
                      {paySummary.hourBreakdown.sundayHolidayDay > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><PartyPopper className="h-5 w-5 text-orange-600" /><span className="text-gray-800">Dom/Festivo diurno</span><span className="text-sm text-gray-600">({fmtH(paySummary.hourBreakdown.sundayHolidayDay)})</span></div><span className="font-semibold text-gray-900">{formatCOP(paySummary.sundayHolidayDayPay)}</span></div>}
                      {paySummary.hourBreakdown.sundayHolidayNight > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Moon className="h-5 w-5 text-purple-600" /><span className="text-gray-800">Dom/Festivo nocturno</span><span className="text-sm text-gray-600">({fmtH(paySummary.hourBreakdown.sundayHolidayNight)})</span></div><span className="font-semibold text-gray-900">{formatCOP(paySummary.sundayHolidayNightPay)}</span></div>}
                    </div>
                    <div className="pt-3 border-t border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg text-blue-900">Total a pagar</span>
                        <span className="font-bold text-xl text-blue-700">{formatCOP(paySummary.totalPay)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-blue-700 leading-relaxed">* Cálculo basado en salario mínimo 2026 y Ley 2466/2025.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Non-admin: hours breakdown only */}
          {selectedPerson !== "all" && paySummary && paySummary.totalHours > 0 && !isAdmin && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
                  <Clock className="h-5 w-5" />
                  Desglose de Horas por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <div className="space-y-3">
                  {paySummary.hourBreakdown.regularDay > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Sun className="h-5 w-5 text-yellow-600" /><span className="text-gray-800">Diurnas ordinarias</span></div><span className="font-semibold text-gray-900">{fmtH(paySummary.hourBreakdown.regularDay)}</span></div>}
                  {paySummary.hourBreakdown.regularNight > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Moon className="h-5 w-5 text-indigo-600" /><span className="text-gray-800">Nocturnas</span></div><span className="font-semibold text-gray-900">{fmtH(paySummary.hourBreakdown.regularNight)}</span></div>}
                  {paySummary.hourBreakdown.sundayHolidayDay > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><PartyPopper className="h-5 w-5 text-orange-600" /><span className="text-gray-800">Dom/Festivo diurno</span></div><span className="font-semibold text-gray-900">{fmtH(paySummary.hourBreakdown.sundayHolidayDay)}</span></div>}
                  {paySummary.hourBreakdown.sundayHolidayNight > 0 && <div className="flex items-center justify-between text-base"><div className="flex items-center gap-2"><Moon className="h-5 w-5 text-purple-600" /><span className="text-gray-800">Dom/Festivo nocturno</span></div><span className="font-semibold text-gray-900">{fmtH(paySummary.hourBreakdown.sundayHolidayNight)}</span></div>}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Records List */}
      <div className="space-y-3">
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
            const isSelectable = selectionMode && !entry.paid && !isActive

            return (
              <div key={entry.id} className="flex items-start gap-2">
                {isSelectable && (
                  <div className="pt-6 shrink-0">
                    <Checkbox
                      checked={selectedEntries.has(entry.rowIndex)}
                      onCheckedChange={() => toggleEntrySelection(entry.rowIndex)}
                      aria-label={`Seleccionar registro de ${entry.personName}`}
                      className="h-5 w-5"
                    />
                  </div>
                )}
                <Card className={`flex-1 ${isActive ? "border-green-200 bg-green-50" : entry.paid ? "border-emerald-200 bg-emerald-50/30" : ""} ${isSelectable && selectedEntries.has(entry.rowIndex) ? "ring-2 ring-blue-400" : ""}`}>
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
                          <span className={`font-bold text-lg ${entry.totalHours > 16 ? "text-red-600" : "text-blue-600"}`}>{fmtH(entry.totalHours)}</span>
                        </div>
                        {entry.totalHours > 16 && (
                          <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 rounded-lg border border-red-200">
                            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                            <span className="text-sm text-red-800 font-medium">
                              ⚠️ Registro anormal — más de 16 horas. Verificar si olvidó marcar salida.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {entry.notes && entry.notes.trim() !== "" && (
                      <div className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-2">
                        <FileText className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                        <span>{entry.notes}</span>
                      </div>
                    )}

                    {/* Images indicator */}
                    {entry.images && entry.images.trim() !== "" && (
                      <button
                        onClick={() => {
                          const imgs = entry.images!.split(",").map((s) => s.trim()).filter(Boolean)
                          setImageViewerImages(imgs)
                          setImageViewerOpen(true)
                        }}
                        className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors w-fit"
                      >
                        <ImageIcon className="h-4 w-4" />
                        {entry.images.split(",").filter((s) => s.trim()).length} imagen{entry.images.split(",").filter((s) => s.trim()).length !== 1 ? "es" : ""}
                      </button>
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
                          variant={entry.paid ? "outline" : "action"}
                          className={`flex-1 h-11 text-sm font-medium ${entry.paid ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "max-w-none bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500"}`}
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

                    {/* Payment confirmation — caregiver confirms payment received */}
                    {!isActive && entry.paid && (
                      <PaymentConfirmation
                        entry={{
                          rowIndex: entry.rowIndex,
                          paid: entry.paid,
                          confirmedByCaregiver: entry.confirmedByCaregiver === "Sí",
                          confirmationDate: entry.confirmationDate,
                          amountConfirmed: entry.amountConfirmed,
                        }}
                        onConfirm={handlePaymentConfirm}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
              </div>
            )
          })
        )}
      </div>

      {/* Advance entries — differentiated cards */}
      {filteredAdvances.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-amber-800 flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Anticipos del mes
          </h3>
          {filteredAdvances.map((advance) => (
            <Card key={`advance-${advance.rowIndex}`} className="border-amber-200 bg-amber-50/60">
              <CardContent className="pt-5 pb-5">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Banknote className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-lg text-gray-900">{advance.personName}</span>
                      <Badge className="bg-amber-100 text-amber-800 text-xs px-2">Anticipo</Badge>
                    </div>
                    <span className="text-base text-gray-600 font-medium">{advance.date}</span>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-700">Monto:</span>
                    <span className="font-bold text-lg text-amber-700">{formatCOP(advance.amount)}</span>
                  </div>

                  {/* Description */}
                  {advance.description && advance.description.trim() !== "" && (
                    <div className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 rounded-lg p-2">
                      <FileText className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{advance.description}</span>
                    </div>
                  )}

                  {/* Confirmation status */}
                  {advance.confirmedByCaregiver ? (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        Anticipo confirmado
                        {advance.confirmationDate && (
                          <span className="text-muted-foreground ml-1">— {advance.confirmationDate}</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConfirmAdvance(advance)}
                      className="flex items-center gap-1 border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmar recibido
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

      {/* Bulk Payment Bar — shown when selection mode is active */}
      {selectionMode && isAdmin && (
        <BulkPaymentBar
          selectedCount={selectedEntries.size}
          onMarkSelectedPaid={handleBulkMarkPaid}
          onMarkAllMonthPaid={dateFilterMode === "month" ? handleBulkMarkAllMonthPaid : undefined}
          onCancel={handleCancelSelection}
          loading={bulkLoading}
        />
      )}

      {/* Image Viewer Modal */}
      <ImageViewerModal
        images={imageViewerImages}
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
      />

      {/* Advance Payment Dialog — admin only */}
      {isAdmin && (
        <AdvancePaymentDialog
          open={advanceDialogOpen}
          onOpenChange={setAdvanceDialogOpen}
          people={localPeople.map((p) => ({ name: p.name }))}
          onAdvanceCreated={loadAdvances}
        />
      )}
    </div>
  )
}
