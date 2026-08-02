"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Wallet, TrendingUp, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Banknote, Receipt, AlertCircle,
} from "lucide-react"
import { formatCOP } from "@/lib/colombian-labor"

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

interface Person {
  id: string
  name: string
  isFixed?: boolean
  fixedRate?: number | null
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

interface CaregiverIncomeSummaryProps {
  personName: string
  timeEntries: TimeEntry[]
  people: Person[]
  advances: Advance[]
  expenses: ShiftExpense[]
  recaudos: Recaudo[]
}

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

export function CaregiverIncomeSummary({
  personName,
  timeEntries,
  people,
  advances,
  expenses,
  recaudos,
}: CaregiverIncomeSummaryProps) {
  const [expanded, setExpanded] = useState(false)

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`

  const summary = useMemo(() => {
    // Filter entries for current month and this person
    const monthEntries = timeEntries.filter((e) => {
      if (e.personName !== personName) return false
      if (!e.clockIn || !e.clockOut || !e.totalHours) return false
      const d = parseSpanishDateTime(e.clockIn)
      if (!d) return false
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })

    // Get person info
    const personInfo = people.find((p) => p.name === personName)
    const isFixed = personInfo?.isFixed || false
    const fixedRate = personInfo?.fixedRate || 0

    // Calculate total hours
    const totalHours = monthEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0)

    // Calculate hourly rate
    let hourlyRate = 0
    let noRecaudo = false

    if (isFixed && fixedRate > 0) {
      hourlyRate = fixedRate
    } else {
      // Variable rate calculation
      const monthRecaudo = recaudos
        .filter((r) => r.month === monthKey)
        .reduce((sum, r) => sum + r.amount, 0)

      if (monthRecaudo <= 0) {
        noRecaudo = true
      } else {
        // Calculate all hours for the month to determine variable rate
        const allMonthEntries = timeEntries.filter((e) => {
          if (!e.clockIn || !e.clockOut || !e.totalHours) return false
          const d = parseSpanishDateTime(e.clockIn)
          if (!d) return false
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear
        })

        let fixedCost = 0
        let variableHours = 0

        for (const e of allMonthEntries) {
          const pi = people.find((p) => p.name === e.personName)
          if (pi?.isFixed && pi?.fixedRate && pi.fixedRate > 0) {
            fixedCost += (e.totalHours || 0) * pi.fixedRate
          } else {
            variableHours += e.totalHours || 0
          }
        }

        const remaining = Math.max(0, monthRecaudo - fixedCost)
        hourlyRate = variableHours > 0 ? Math.round(remaining / variableHours) : 0
      }
    }

    // Calculate gross pay (expected)
    const grossPay = Math.round(totalHours * hourlyRate)

    // Calculate expenses and income for this person's entries
    const entryRowIndices = new Set(monthEntries.map((e) => e.rowIndex))
    const personExpenses = expenses.filter(
      (exp) => exp.personName === personName && entryRowIndices.has(exp.entryRowIndex)
    )
    const totalExpenses = personExpenses
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0)
    const totalIncome = personExpenses
      .filter((e) => e.type === "income")
      .reduce((sum, e) => sum + e.amount, 0)

    // Calculate advances for this person in this month
    const personAdvances = advances.filter(
      (a) => a.personName === personName && a.month === monthKey
    )
    const totalAdvances = personAdvances.reduce((sum, a) => sum + a.amount, 0)

    // Net expected = gross + expenses - income - advances
    const netExpected = grossPay + totalExpenses - totalIncome - totalAdvances

    // Calculate paid amount (sum of paid entries)
    const paidEntries = monthEntries.filter((e) => e.paid)
    const paidHours = paidEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0)
    const paidAmount = Math.round(paidHours * hourlyRate)

    // Pending = expected - paid (simplified view)
    // For detailed view, we'll show net expected
    const pendingAmount = Math.max(0, netExpected - paidAmount)

    return {
      totalHours,
      hourlyRate,
      grossPay,
      totalExpenses,
      totalIncome,
      totalAdvances,
      netExpected,
      paidAmount,
      pendingAmount,
      isFixed,
      noRecaudo,
      paidCount: paidEntries.length,
      totalCount: monthEntries.length,
      hasAdjustments: totalExpenses > 0 || totalIncome > 0 || totalAdvances > 0,
    }
  }, [personName, timeEntries, people, advances, expenses, recaudos, currentMonth, currentYear, monthKey])

  // Don't render if no data at all
  if (summary.totalCount === 0 && !summary.hasAdjustments) {
    return null
  }

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
            <Wallet className="h-5 w-5" />
            Resumen {MONTH_NAMES[currentMonth]}
          </CardTitle>
          <Badge
            variant="outline"
            className={`text-xs ${
              summary.pendingAmount > 0
                ? "border-orange-300 text-orange-700 bg-orange-50"
                : "border-emerald-300 text-emerald-700 bg-emerald-50"
            }`}
          >
            {summary.pendingAmount > 0 ? "Pendiente" : "Al día"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {summary.noRecaudo ? (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Sin recaudo registrado</p>
              <p className="text-xs text-amber-700 mt-0.5">
                No hay recaudo para {MONTH_NAMES[currentMonth]}. El valor por hora no se puede calcular.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Simple summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-white/60 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Esperado</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {formatCOP(summary.netExpected)}
                </p>
              </div>
              <div className="text-center p-3 bg-white/60 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-medium">Pagado</span>
                </div>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCOP(summary.paidAmount)}
                </p>
              </div>
              <div className="text-center p-3 bg-white/60 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Pendiente</span>
                </div>
                <p className="text-lg font-bold text-orange-700">
                  {formatCOP(summary.pendingAmount)}
                </p>
              </div>
            </div>

            {/* Expand/collapse button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full h-8 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Ocultar detalles
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Ver detalles
                </>
              )}
            </Button>

            {/* Expanded details */}
            {expanded && (
              <div className="space-y-3 pt-2 border-t border-emerald-200">
                {/* Hours and rate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Horas trabajadas</span>
                    <span className="font-medium text-gray-900">
                      {Math.floor(summary.totalHours)}h {Math.round((summary.totalHours % 1) * 60)}m
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      Valor hora
                      {summary.isFixed && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-300 text-blue-700">
                          Fijo
                        </Badge>
                      )}
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatCOP(summary.hourlyRate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Pago bruto</span>
                    <span className="font-medium text-gray-900">
                      {formatCOP(summary.grossPay)}
                    </span>
                  </div>
                </div>

                {/* Adjustments */}
                {summary.hasAdjustments && (
                  <div className="space-y-2 pt-2 border-t border-emerald-100">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Ajustes
                    </p>
                    {summary.totalExpenses > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Receipt className="h-3.5 w-3.5" />
                          Gastos extra
                        </span>
                        <span className="font-medium text-red-600">
                          +{formatCOP(summary.totalExpenses)}
                        </span>
                      </div>
                    )}
                    {summary.totalIncome > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Receipt className="h-3.5 w-3.5" />
                          Dinero recibido
                        </span>
                        <span className="font-medium text-emerald-600">
                          −{formatCOP(summary.totalIncome)}
                        </span>
                      </div>
                    )}
                    {summary.totalAdvances > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Banknote className="h-3.5 w-3.5" />
                          Anticipos
                        </span>
                        <span className="font-medium text-amber-600">
                          −{formatCOP(summary.totalAdvances)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status summary */}
                <div className="pt-2 border-t border-emerald-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Registros pagados</span>
                    <span className="font-medium text-gray-900">
                      {summary.paidCount} de {summary.totalCount}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
