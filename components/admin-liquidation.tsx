"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Calculator, ChevronLeft, ChevronRight, RefreshCw, Check,
  Clock, DollarSign, AlertCircle, Users, Wallet, Filter,
} from "lucide-react"
import { formatCOP } from "@/lib/colombian-labor"
import {
  fetchPeople, fetchTimeEntries, fetchAdvances, fetchExpenses,
  fetchRecaudos, postBulkTogglePaid,
} from "@/lib/api-client"

interface Person {
  id: string
  name: string
  isFixed?: boolean
  fixedRate?: number | null
}

interface TimeEntry {
  id: string
  rowIndex: number
  personName: string
  clockIn: string
  clockOut?: string
  totalHours?: number
  paid: boolean
  date: string
  hourlyValue?: number
}

interface Advance {
  rowIndex: number
  personName: string
  amount: number
  date: string
  month: string
  description: string
}

interface ShiftExpense {
  rowIndex: number
  personName: string
  entryRowIndex: number
  type: "expense" | "income"
  amount: number
  description: string
  date: string
}

interface Recaudo {
  rowIndex: number
  month: string
  amount: number
  description: string
}

type PaymentFilter = "all" | "pending" | "paid"

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function parseSpanishDateTime(s: string): Date | null {
  try {
    const [d, t] = s.split(", ")
    const [day, mo, yr] = d.split("/").map(Number)
    const [h, m, sec] = t.split(":").map(Number)
    return new Date(yr, mo - 1, day, h, m, sec || 0)
  } catch {
    return null
  }
}

function formatHours(h: number): string {
  const hr = Math.floor(h)
  const m = Math.round((h - hr) * 60)
  return `${hr}h ${m}m`
}

interface CaregiverSummary {
  name: string
  totalHours: number
  hourlyRate: number
  isFixed: boolean
  grossPay: number
  totalExpenses: number
  totalIncome: number
  totalAdvances: number
  netPay: number
  paidAmount: number
  pendingAmount: number
  paidCount: number
  totalCount: number
  unpaidRowIndices: number[]
  status: "paid" | "partial" | "pending"
}

export function AdminLiquidation() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all")
  const [loading, setLoading] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  // Data states
  const [people, setPeople] = useState<Person[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [advances, setAdvances] = useState<Advance[]>([])
  const [allExpenses, setAllExpenses] = useState<ShiftExpense[]>([])
  const [recaudos, setRecaudos] = useState<Recaudo[]>([])

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pData, eData, aData, expData, rData] = await Promise.all([
        fetchPeople(),
        fetchTimeEntries(),
        fetchAdvances(monthKey),
        fetchExpenses(),
        fetchRecaudos(),
      ])
      if (!pData.error) setPeople(pData)
      if (!eData.error) setTimeEntries(eData)
      if (!aData.error && Array.isArray(aData)) setAdvances(aData)
      if (!expData.error && Array.isArray(expData)) setAllExpenses(expData)
      if (!rData.error && Array.isArray(rData)) setRecaudos(rData)
    } catch {}
    finally { setLoading(false) }
  }, [monthKey])

  useEffect(() => { loadData() }, [loadData])

  // Calculate monthly recaudo total
  const monthRecaudo = useMemo(() => {
    return recaudos
      .filter((r) => r.month === monthKey)
      .reduce((sum, r) => sum + r.amount, 0)
  }, [recaudos, monthKey])

  // Calculate per-caregiver summaries
  const caregiverSummaries = useMemo(() => {
    // Filter entries for selected month with completed shifts
    const monthEntries = timeEntries.filter((e) => {
      if (!e.clockIn || !e.clockOut || !e.totalHours) return false
      const d = parseSpanishDateTime(e.clockIn)
      if (!d) return false
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    })

    // Calculate fixed costs and variable hours for the entire month
    let totalFixedCost = 0
    let totalVariableHours = 0

    for (const e of monthEntries) {
      const pi = people.find((p) => p.name === e.personName)
      if (pi?.isFixed && pi?.fixedRate && pi.fixedRate > 0) {
        totalFixedCost += (e.totalHours || 0) * pi.fixedRate
      } else {
        totalVariableHours += e.totalHours || 0
      }
    }

    const remainingForVariable = Math.max(0, monthRecaudo - totalFixedCost)
    const variableRate = totalVariableHours > 0 ? Math.round(remainingForVariable / totalVariableHours) : 0

    // Build summary for each caregiver
    const summaries: CaregiverSummary[] = people.map((person) => {
      const personEntries = monthEntries.filter((e) => e.personName === person.name)
      const totalHours = personEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0)

      // Determine hourly rate
      const isFixed = person.isFixed || false
      const hourlyRate = (isFixed && person.fixedRate && person.fixedRate > 0)
        ? person.fixedRate
        : variableRate

      // Calculate gross pay
      const grossPay = Math.round(totalHours * hourlyRate)

      // Calculate expenses and income for this person's entries
      const entryRowIndices = new Set(personEntries.map((e) => e.rowIndex))
      const personExpenses = allExpenses.filter(
        (exp) => exp.personName === person.name && entryRowIndices.has(exp.entryRowIndex)
      )
      const totalExpenses = personExpenses
        .filter((e) => e.type === "expense")
        .reduce((sum, e) => sum + e.amount, 0)
      const totalIncome = personExpenses
        .filter((e) => e.type === "income")
        .reduce((sum, e) => sum + e.amount, 0)

      // Calculate advances for this person in this month
      const personAdvances = advances.filter(
        (a) => a.personName === person.name && a.month === monthKey
      )
      const totalAdvances = personAdvances.reduce((sum, a) => sum + a.amount, 0)

      // Net pay = gross + expenses - income - advances
      const netPay = grossPay + totalExpenses - totalIncome - totalAdvances

      // Calculate paid amount
      const paidEntries = personEntries.filter((e) => e.paid)
      const paidHours = paidEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0)
      const paidAmount = Math.round(paidHours * hourlyRate)

      // Pending
      const pendingAmount = Math.max(0, netPay - paidAmount)

      // Unpaid row indices (for marking as paid)
      const unpaidRowIndices = personEntries
        .filter((e) => !e.paid)
        .map((e) => e.rowIndex)

      // Status
      let status: "paid" | "partial" | "pending"
      if (paidEntries.length === 0 && personEntries.length > 0) {
        status = "pending"
      } else if (paidEntries.length === personEntries.length) {
        status = "paid"
      } else {
        status = "partial"
      }

      return {
        name: person.name,
        totalHours,
        hourlyRate,
        isFixed,
        grossPay,
        totalExpenses,
        totalIncome,
        totalAdvances,
        netPay,
        paidAmount,
        pendingAmount,
        paidCount: paidEntries.length,
        totalCount: personEntries.length,
        unpaidRowIndices,
        status,
      }
    })

    return summaries
  }, [people, timeEntries, allExpenses, advances, monthRecaudo, selectedMonth, selectedYear, monthKey])

  // Apply payment filter
  const filteredSummaries = useMemo(() => {
    if (paymentFilter === "all") return caregiverSummaries
    if (paymentFilter === "pending") {
      return caregiverSummaries.filter((s) => s.status === "pending" || s.status === "partial")
    }
    return caregiverSummaries.filter((s) => s.status === "paid")
  }, [caregiverSummaries, paymentFilter])

  // Calculate totals
  const totals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, s) => ({
        totalHours: acc.totalHours + s.totalHours,
        grossPay: acc.grossPay + s.grossPay,
        adjustments: acc.adjustments + (s.totalExpenses - s.totalIncome - s.totalAdvances),
        netPay: acc.netPay + s.netPay,
        paidAmount: acc.paidAmount + s.paidAmount,
        pendingAmount: acc.pendingAmount + s.pendingAmount,
      }),
      { totalHours: 0, grossPay: 0, adjustments: 0, netPay: 0, paidAmount: 0, pendingAmount: 0 }
    )
  }, [filteredSummaries])

  // Navigation handlers
  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear((y) => y - 1)
    } else {
      setSelectedMonth((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear((y) => y + 1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
  }

  const goToCurrentMonth = () => {
    setSelectedMonth(now.getMonth())
    setSelectedYear(now.getFullYear())
  }

  // Mark as paid handler
  const handleMarkAsPaid = async (personName: string, rowIndices: number[]) => {
    if (rowIndices.length === 0) return
    setMarkingPaid(personName)
    try {
      await postBulkTogglePaid(rowIndices, true)
      await loadData()
    } catch {}
    finally { setMarkingPaid(null) }
  }

  const noRecaudo = monthRecaudo <= 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Liquidación Mensual
          </CardTitle>
          <Button variant="outline" onClick={loadData} disabled={loading} className="h-10 w-10 p-0">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
          <Button
            variant="outline"
            onClick={goToPrevMonth}
            className="h-10 w-10 p-0 border-2 bg-white hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <button
            onClick={goToCurrentMonth}
            className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors"
          >
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </button>
          <Button
            variant="outline"
            onClick={goToNextMonth}
            className="h-10 w-10 p-0 border-2 bg-white hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Recaudo summary */}
        {noRecaudo ? (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Sin recaudo registrado</p>
              <p className="text-xs text-amber-700 mt-0.5">
                No hay recaudo para {MONTH_NAMES[selectedMonth]} {selectedYear}. 
                Los cuidadores con tarifa variable aparecerán con $0.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Recaudo del mes:</span>
            </div>
            <span className="text-lg font-bold text-blue-700">{formatCOP(monthRecaudo)}</span>
          </div>
        )}

        {/* Payment filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtrar:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {(["all", "pending", "paid"] as PaymentFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setPaymentFilter(filter)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  paymentFilter === filter
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {filter === "all" ? "Todos" : filter === "pending" ? "Pendientes" : "Pagados"}
              </button>
            ))}
          </div>
        </div>

        {/* Liquidation table */}
        {loading && people.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Cargando datos...</p>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base text-gray-500">
              {paymentFilter === "all"
                ? "No hay cuidadores registrados"
                : paymentFilter === "pending"
                ? "No hay pagos pendientes"
                : "No hay pagos completados"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold text-gray-900">Cuidador</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right">Horas</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right">Tarifa</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right">Bruto</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right">Ajustes</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right">Neto</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.map((summary) => {
                  const adjustments = summary.totalExpenses - summary.totalIncome - summary.totalAdvances
                  const isMarking = markingPaid === summary.name

                  return (
                    <TableRow key={summary.name} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{summary.name}</span>
                          {summary.isFixed && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-300 text-blue-700">
                              Fijo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-gray-700">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatHours(summary.totalHours)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-gray-700">
                        {formatCOP(summary.hourlyRate)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-gray-900">
                        {formatCOP(summary.grossPay)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={adjustments >= 0 ? "text-red-600" : "text-emerald-600"}>
                          {adjustments >= 0 ? "+" : ""}{formatCOP(adjustments)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900">
                        {formatCOP(summary.netPay)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`text-xs ${
                            summary.status === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : summary.status === "partial"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {summary.status === "paid"
                            ? "Pagado"
                            : summary.status === "partial"
                            ? `${summary.paidCount}/${summary.totalCount}`
                            : "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {summary.unpaidRowIndices.length > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsPaid(summary.name, summary.unpaidRowIndices)}
                            disabled={isMarking}
                            className="h-8 text-xs font-medium border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            {isMarking ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-1" />
                            )}
                            Pagar
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}

                {/* Totals row */}
                <TableRow className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                  <TableCell className="text-gray-900">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      TOTAL
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-gray-900">
                    {formatHours(totals.totalHours)}
                  </TableCell>
                  <TableCell className="text-right text-gray-400">—</TableCell>
                  <TableCell className="text-right text-gray-900">
                    {formatCOP(totals.grossPay)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={totals.adjustments >= 0 ? "text-red-600" : "text-emerald-600"}>
                      {totals.adjustments >= 0 ? "+" : ""}{formatCOP(totals.adjustments)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-blue-700 text-lg">
                    {formatCOP(totals.netPay)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="text-xs">
                      <span className="text-emerald-700">{formatCOP(totals.paidAmount)}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-orange-700">{formatCOP(totals.pendingAmount)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-gray-400">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Pagado</Badge>
            <span>= Todos los registros pagados</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge className="bg-amber-100 text-amber-700 text-[10px]">2/5</Badge>
            <span>= Parcialmente pagado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge className="bg-orange-100 text-orange-700 text-[10px]">Pendiente</Badge>
            <span>= Sin pagos</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
