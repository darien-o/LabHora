"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postPaymentConfirmation } from "@/lib/api-client";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

interface PaymentEntry {
  rowIndex: number;
  paid: boolean;
  confirmedByCaregiver?: boolean;
  confirmationDate?: string;
  amountConfirmed?: number;
}

interface PaymentConfirmationProps {
  entry: PaymentEntry;
  onConfirm: (rowIndex: number, amountReceived?: number) => void;
}

export function PaymentConfirmation({
  entry,
  onConfirm,
}: PaymentConfirmationProps) {
  const [showAmountInput, setShowAmountInput] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [loading, setLoading] = useState(false);

  // Not paid — nothing to show
  if (!entry.paid) {
    return null;
  }

  // Already confirmed by caregiver
  if (entry.confirmedByCaregiver) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        <span>
          Pago confirmado
          {entry.confirmationDate && (
            <span className="text-muted-foreground ml-1">
              — {entry.confirmationDate}
            </span>
          )}
          {entry.amountConfirmed != null && (
            <span className="text-muted-foreground ml-1">
              (${entry.amountConfirmed.toLocaleString()})
            </span>
          )}
        </span>
      </div>
    );
  }

  // Paid but not confirmed — show pending indicator and confirm button
  const handleConfirm = async () => {
    setLoading(true);
    try {
      const parsedAmount = amountReceived
        ? parseFloat(amountReceived)
        : undefined;
      await postPaymentConfirmation(
        entry.rowIndex,
        parsedAmount && !isNaN(parsedAmount) ? parsedAmount : undefined
      );
      onConfirm(
        entry.rowIndex,
        parsedAmount && !isNaN(parsedAmount) ? parsedAmount : undefined
      );
    } catch {
      // Error is handled silently — the parent can re-fetch state
    } finally {
      setLoading(false);
      setShowAmountInput(false);
      setAmountReceived("");
    }
  };

  return (
    <div className="space-y-2">
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200"
      >
        <Clock className="h-3 w-3 mr-1" />
        Pendiente de confirmación
      </Badge>

      {showAmountInput ? (
        <div className="flex items-end gap-2">
          <div className="space-y-1 flex-1">
            <Label htmlFor={`amount-${entry.rowIndex}`} className="text-xs">
              Monto recibido{" "}
              <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id={`amount-${entry.rowIndex}`}
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              disabled={loading}
              className="h-8 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className="h-8"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Confirmar"
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowAmountInput(false);
              setAmountReceived("");
            }}
            disabled={loading}
            className="h-8"
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAmountInput(true)}
          className="flex items-center gap-1"
        >
          <CheckCircle2 className="h-3 w-3" />
          Confirmar pago
        </Button>
      )}
    </div>
  );
}
