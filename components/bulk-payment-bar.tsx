"use client"

import { Check, X, Loader2, CalendarCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BulkPaymentBarProps {
  /** Number of currently selected entries */
  selectedCount: number
  /** Callback to mark selected entries as paid */
  onMarkSelectedPaid: () => void
  /** Callback to mark all entries in the current month as paid (shown when provided) */
  onMarkAllMonthPaid?: () => void
  /** Callback to exit selection mode */
  onCancel: () => void
  /** Whether a bulk operation is in progress */
  loading?: boolean
}

export function BulkPaymentBar({
  selectedCount,
  onMarkSelectedPaid,
  onMarkAllMonthPaid,
  onCancel,
  loading = false,
}: BulkPaymentBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
      <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3">
        {/* Selected count and cancel */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedCount === 0
              ? "Ningún registro seleccionado"
              : `${selectedCount} registro${selectedCount !== 1 ? "s" : ""} seleccionado${selectedCount !== 1 ? "s" : ""}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={loading}
            aria-label="Salir del modo de selección"
          >
            <X className="mr-1 h-4 w-4" />
            Cancelar
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="action"
            className="flex-1"
            onClick={onMarkSelectedPaid}
            disabled={selectedCount === 0 || loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Marcar seleccionados como pagados
          </Button>

          {onMarkAllMonthPaid && (
            <Button
              variant="outline"
              className="shrink-0"
              onClick={onMarkAllMonthPaid}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarCheck className="mr-2 h-4 w-4" />
              )}
              Marcar todo el mes
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
