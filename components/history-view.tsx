"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  RefreshCw, Clock, Calendar, User, AlertCircle, DollarSign,
  Moon, Sun, PartyPopper, ChevronLeft, ChevronRight, Check, X,
  Filter, CircleDollarSign,
} from "lucide-react"
import { calculatePaySummary, formatCOP, type PaySummary } from "@/lib/colombian-labor"
import { fetchPeople, fetchTimeEntries, postTogglePaid } from "@/lib/api-client"
import { useAdmin } from "@/lib/admin-context"

interface TimeEntry {
  id: string
  rowIndex: number
  personName: string
  clockIn: string
  clockOut?: string
  totalHours?: number
  paid: boolean
  date: string
}

interface Person {
  id: string
  name: string
}

type DateFilterMode = "month" | "range" | "all"

interface HistoryViewProps {
  timeEntries: TimeEntry[]
  people: Person[]
  onRefresh: () => void
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function HistoryView({ timeEntries, people, onRefresh }: HistoryViewProps) {
  const { isAdmin } = useAdmin()
  const [selectedPerson, setSelectedPerson] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [localPeople, setLocalPeople] = useState<Person[]>([])
  const [localEntries, setLocalEntries] = useState<TimeEntry[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Date filter state
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("month")
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [rangeFrom, setRangeFrom] = useState("")
  const [rangeTo, setRangeTo] = useState("")

  useEffect(() => { loadFreshData() }, [])
  useEffect(() => { setLocalPeople(people); setLocalEntries(timeEntries) }, [people, timeEntries])

  const loadFreshData = async () => {
    setLoading(true)
    try {
      const [peopleData, entriesData] = await Promise.all([
        fetchPeople(),
        fetchTimeEntries(),
      ])
      if (!peopleData.error) setLocalPeople(peopleData)
      if (!entriesData.error) setLocalEntries(entriesData)
    } catch (error) {
      console.error("Error loading fresh data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Parse "DD/MM/YYYY, HH:mm:ss" to Date
  const parseSpanishDateTime = useCallback((dateTimeStr: string): Date => {
    try {
      const [datePart, timePart] = dateTimeStr.split(", ")
      const [day, month, year] = datePart.split("/")
      const [hour, minute, second] = timePart.split(":")
      return new Date(
        Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day),
        Number.parseInt(hour), Number.parseInt(minute), Number.parseInt(second || "0"),
      )
    } catch {
      return new Date()
    }
  }, [])

  // Filter by person
  const personFiltered = useMemo(() => {
    if (selectedPerson === "all") return localEntries
    return localEntries.filter((e) => e.personName === selectedPerson)
  }, [localEntries, selectedPerson])

  // Filter by date
  const filteredEntries = useMemo(() => {
    return personFiltered.filter((entry) => {
      const entryDate = parseSpanishDateTime(entry.clockIn)
      if (dateFilterMode === "month") {
        return entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === selectedYear
      }
      if (dateFilterMode === "range" && rangeFrom && rangeTo) {
        const from = new Date(rangeFrom + "T00:00:00")
        const to = new Date(rangeTo + "T23:59:59")
        return entryDate >= from && entryDate <= to
      }
      return true // "all" mode
    })
  }, [personFiltered, dateFilterMode, selectedMonth, selectedYear, rangeFrom, rangeTo, parseSpanishDateTime])

  const totalHours = useMemo(() => {
    return filteredEntries.reduce((t, e) => t + (e.totalHours || 0), 0)
  }, [filteredEntries])

  const paySummary: PaySummary | null = useMemo(() => {
    if (selectedPerson === "all") return null
    const completed = filteredEntries
      .filter((e) => e.clockIn && e.clockOut)
      .map((e) => ({ clockIn: parseSpanishDateTime(e.clockIn), clockOut: parseSpanishDateTime(e.clockOut!) }))
    if (completed.length === 0) return null
    return calculatePaySummary(completed)
  }, [filteredEntries, selectedPerson, parseSpanishDateTime])

  // Paid/unpaid summary
  const paidSummary = useMemo(() => {
    const completed = filteredEntries.filter((e) => e.clockOut)
    const paidEntries = completed.filter((e) => e.paid)
    const unpaidEntries = completed.filter((e) => !e.paid)
    return {
      paidCount: paidEntries.length,
      unpaidCount: unpaidEntries.length,
      paidHours: paidEntries.reduce((t, e) => t + (e.totalHours || 0), 0),
      unpaidHours: unpaidEntries.reduce((t, e) => t + (e.totalHours || 0), 0),
    }
  }, [filteredEntries])

  const formatDateTime = (dateString: string) => {
    try {
      const date = parseSpanishDateTime(dateString)
      return {
        date: date.toLocaleDateString("es-ES"),
        time: date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      }
    } catch {
      return { date: "Fecha inválida", time: "Hora inválida" }
    }
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const handleRefresh = async () => {
    setLoading(true)
    try { await loadFreshData(); await onRefresh() } finally { setLoading(false) }
  }

  const handleTogglePaid = async (entry: TimeEntry) => {
    setTogglingId(entry.id)
    try {
      await postTogglePaid(entry.rowIndex, !entry.paid)
      setLocalEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, paid: !entry.paid } : e))
      )
    } catch (error) {
      console.error("Error toggling paid:", error)
    } finally {
      setTogglingId(null)
    }
  }

  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1) }
    else setSelectedMonth((m) => m - 1)
  }
  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1) }
    else setSelectedMonth((m) => m + 1)
  }
  const goToCurrentMonth = () => { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()) }

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      try {
        return parseSpanishDateTime(b.clockIn).getTime() - parseSpanishDateTime(a.clockIn).getTime()
      } catch { return 0 }
    })
  }, [filteredEntries, parseSpanishDateTime])

  return (
    <div className="space-y-5">
      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Historial de Registros
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="h-11 w-11 p-0">
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Person filter */}
          <div>
            <label className="text-base font-semibold text-gray-800 mb-2 block">Filtrar por cuidador:</label>
            {localPeople.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-base text-yellow-900">No se encontraron cuidadores en la hoja</span>
              </div>
            ) : (
              <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Seleccionar cuidador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-base py-3">Todos los cuidadores</SelectItem>
                  {localPeople.map((p) => (
                    <SelectItem key={p.id} value={p.name} className="text-base py-3">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Date filter mode */}
          <div>
            <label className="text-base font-semibold text-gray-800 mb-2 block">
              <Filter className="h-4 w-4 inline mr-1" />
              Filtrar por fecha:
            </label>
            <div className="flex gap-2">
              {(["month", "range", "all"] as DateFilterMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={dateFilterMode === mode ? "default" : "outline"}
                  onClick={() => setDateFilterMode(mode)}
                  className="flex-1 h-12 text-base font-medium"
                >
                  {mode === "month" ? "Mes" : mode === "range" ? "Rango" : "Todo"}
                </Button>
              ))}
            </div>
          </div>

          {/* Month navigator */}
          {dateFilterMode === "month" && (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
              <Button variant="ghost" size="sm" onClick={goToPrevMonth} className="h-11 w-11 p-0">
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <button
                onClick={goToCurrentMonth}
                className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </button>
              <Button variant="ghost" size="sm" onClick={goToNextMonth} className="h-11 w-11 p-0">
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          )}

          {/* Date range inputs */}
          {dateFilterMode === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Desde:</label>
                <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Hasta:</label>
                <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              </div>
            </div>
          )}

          {/* Person summary */}
          {selectedPerson !== "all" && (
            <div className="p-5 bg-blue-50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-lg text-blue-900">{selectedPerson}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="font-bold text-lg text-blue-900">{formatHours(totalHours)}</span>
                </div>
              </div>
              <p className="text-base text-blue-700">
                {filteredEntries.length} registro{filteredEntries.length !== 1 ? "s" : ""}
              </p>
              {/* Paid/unpaid summary */}
              {(paidSummary.paidCount > 0 || paidSummary.unpaidCount > 0) && (
                <div className="flex gap-4 pt-1">
                  {paidSummary.paidCount > 0 && (
                    <span className="text-sm flex items-center gap-1.5 text-green-800 font-medium">
                      <Check className="h-4 w-4" /> {paidSummary.paidCount} pagado{paidSummary.paidCount !== 1 ? "s" : ""} ({formatHours(paidSummary.paidHours)})
                    </span>
                  )}
                  {paidSummary.unpaidCount > 0 && (
                    <span className="text-sm flex items-center gap-1.5 text-orange-800 font-medium">
                      <CircleDollarSign className="h-4 w-4" /> {paidSummary.unpaidCount} pendiente{paidSummary.unpaidCount !== 1 ? "s" : ""} ({formatHours(paidSummary.unpaidHours)})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Colombian Labor Law Pay Breakdown */}
          {selectedPerson !== "all" && paySummary && paySummary.totalHours > 0 && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
                  {isAdmin ? <DollarSign className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  {isAdmin ? "Liquidación según Ley Laboral Colombiana" : "Desglose de Horas por Tipo"}
                </CardTitle>
                {isAdmin && (
                  <p className="text-sm text-emerald-700">
                    SMLMV 2026: {formatCOP(paySummary.monthlyMinWage)} · Valor hora: {formatCOP(Math.round(paySummary.hourlyRate))}
                  </p>
                )}
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <div className="space-y-3">
                  {paySummary.hourBreakdown.regularDay > 0 && (
                    <div className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <Sun className="h-5 w-5 text-yellow-600" />
                        <span className="text-gray-800">Diurnas ordinarias</span>
                        <span className="text-sm text-gray-600">({formatHours(paySummary.hourBreakdown.regularDay)})</span>
                      </div>
                      {isAdmin && <span className="font-semibold text-gray-900">{formatCOP(paySummary.regularDayPay)}</span>}
                    </div>
                  )}
                  {paySummary.hourBreakdown.regularNight > 0 && (
                    <div className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <Moon className="h-5 w-5 text-indigo-600" />
                        <span className="text-gray-800">Nocturnas +35%</span>
                        <span className="text-sm text-gray-600">({formatHours(paySummary.hourBreakdown.regularNight)})</span>
                      </div>
                      {isAdmin && <span className="font-semibold text-gray-900">{formatCOP(paySummary.regularNightPay)}</span>}
                    </div>
                  )}
                  {paySummary.hourBreakdown.sundayHolidayDay > 0 && (
                    <div className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <PartyPopper className="h-5 w-5 text-orange-600" />
                        <span className="text-gray-800">Dom/Festivo diurno</span>
                        <span className="text-sm text-gray-600">({formatHours(paySummary.hourBreakdown.sundayHolidayDay)})</span>
                      </div>
                      {isAdmin && <span className="font-semibold text-gray-900">{formatCOP(paySummary.sundayHolidayDayPay)}</span>}
                    </div>
                  )}
                  {paySummary.hourBreakdown.sundayHolidayNight > 0 && (
                    <div className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <Moon className="h-5 w-5 text-purple-600" />
                        <span className="text-gray-800">Dom/Festivo nocturno</span>
                        <span className="text-sm text-gray-600">({formatHours(paySummary.hourBreakdown.sundayHolidayNight)})</span>
                      </div>
                      {isAdmin && <span className="font-semibold text-gray-900">{formatCOP(paySummary.sundayHolidayNightPay)}</span>}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <>
                    <div className="pt-3 border-t border-emerald-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg text-emerald-900">Total a pagar</span>
                        <span className="font-bold text-xl text-emerald-700">{formatCOP(paySummary.totalPay)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      * Cálculo basado en salario mínimo 2026 y Ley 2466/2025. Recargo nocturno desde las 7:00 PM. Dominicales/festivos +80% (hasta Jul 2026), +90% (desde Jul 2026). No incluye prestaciones sociales ni parafiscales.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Records List */}
      <div className="space-y-4">
        {loading && localEntries.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-base text-gray-700 mt-3">Cargando registros...</p>
              </div>
            </CardContent>
          </Card>
        ) : sortedEntries.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <Calendar className="h-14 w-14 text-gray-400 mx-auto mb-4" />
                <p className="text-lg text-gray-700">No hay registros para mostrar</p>
                <p className="text-base text-gray-500 mt-2">
                  {dateFilterMode === "month"
                    ? `No hay registros en ${MONTH_NAMES[selectedMonth]} ${selectedYear}`
                    : selectedPerson === "all"
                    ? "No se encontraron registros de tiempo"
                    : `No se encontraron registros para ${selectedPerson}`}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          sortedEntries.map((entry) => {
            const clockInFormatted = formatDateTime(entry.clockIn)
            const clockOutFormatted = entry.clockOut ? formatDateTime(entry.clockOut) : null
            const isActive = !entry.clockOut
            const isToggling = togglingId === entry.id

            return (
              <Card
                key={entry.id}
                className={
                  isActive
                    ? "border-green-200 bg-green-50"
                    : entry.paid
                    ? "border-emerald-200 bg-emerald-50/30"
                    : ""
                }
              >
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                        <span className="font-semibold text-lg text-gray-900">{entry.personName}</span>
                        {isActive && <Badge className="bg-green-100 text-green-800 text-sm px-2">Activo</Badge>}
                        {!isActive && entry.paid && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs px-2">Pagado</Badge>
                        )}
                        {!isActive && !entry.paid && (
                          <Badge variant="outline" className="text-orange-700 border-orange-400 text-xs px-2">Pendiente</Badge>
                        )}
                      </div>
                      <span className="text-base text-gray-600 font-medium">{clockInFormatted.date}</span>
                    </div>

                    {/* Times */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600 uppercase tracking-wide font-medium">Entrada</p>
                        <p className="font-mono text-xl font-bold text-gray-900">{clockInFormatted.time}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600 uppercase tracking-wide font-medium">Salida</p>
                        <p className="font-mono text-xl font-bold text-gray-900">
                          {clockOutFormatted ? clockOutFormatted.time : "En curso..."}
                        </p>
                      </div>
                    </div>

                    {/* Total hours + paid toggle */}
                    {entry.totalHours !== undefined && (
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-base text-gray-700">Tiempo total:</span>
                          <span className="font-bold text-lg text-blue-600">{formatHours(entry.totalHours)}</span>
                        </div>
                      </div>
                    )}

                    {/* Paid toggle button */}
                    {!isActive && isAdmin && (
                      <Button
                        variant={entry.paid ? "outline" : "default"}
                        className={`w-full h-12 text-base font-medium ${
                          entry.paid
                            ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }`}
                        disabled={isToggling}
                        onClick={() => handleTogglePaid(entry)}
                      >
                        {isToggling ? (
                          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                        ) : entry.paid ? (
                          <Check className="h-5 w-5 mr-2" />
                        ) : (
                          <CircleDollarSign className="h-5 w-5 mr-2" />
                        )}
                        {entry.paid ? "Pagado ✓" : "Marcar como pagado"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Total summary for all */}
      {filteredEntries.length > 0 && (
        <Card className="bg-gray-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-lg text-gray-800">Total general:</span>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-700" />
                <span className="font-bold text-xl text-gray-900">{formatHours(totalHours)}</span>
              </div>
            </div>
            <p className="text-base text-gray-600 mt-1">
              {filteredEntries.length} registro{filteredEntries.length !== 1 ? "s" : ""} en total
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
