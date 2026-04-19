"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Banknote, Loader2, AlertTriangle } from "lucide-react";
import { postAdvance } from "@/lib/api-client";

interface AdvancePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: Array<{ name: string }>;
  onAdvanceCreated: () => void;
}

export function AdvancePaymentDialog({
  open,
  onOpenChange,
  people,
  onAdvanceCreated,
}: AdvancePaymentDialogProps) {
  const [selectedPerson, setSelectedPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!selectedPerson) {
      setError("Selecciona un cuidador");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setError("Ingresa un monto válido mayor a cero");
      return;
    }

    if (!date) {
      setError("Selecciona una fecha");
      return;
    }

    setLoading(true);

    try {
      const month = date.substring(0, 7); // YYYY-MM from YYYY-MM-DD
      await postAdvance({
        action: "add",
        personName: selectedPerson,
        amount: numericAmount,
        date,
        month,
        description: description || undefined,
      });
      onAdvanceCreated();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al registrar el anticipo"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedPerson("");
    setAmount("");
    setDate("");
    setDescription("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-600" />
            Registrar Anticipo
          </DialogTitle>
          <DialogDescription>
            Registrar un anticipo o abono para un cuidador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="advance-person">Cuidador</Label>
            <Select
              value={selectedPerson}
              onValueChange={setSelectedPerson}
              disabled={loading}
            >
              <SelectTrigger id="advance-person">
                <SelectValue placeholder="Seleccionar cuidador" />
              </SelectTrigger>
              <SelectContent>
                {people.map((person) => (
                  <SelectItem key={person.name} value={person.name}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="advance-amount">Monto</Label>
            <Input
              id="advance-amount"
              type="number"
              min="1"
              step="any"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="advance-date">Fecha</Label>
            <Input
              id="advance-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="advance-description">
              Descripción{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="advance-description"
              placeholder="Descripción del anticipo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Registrar Anticipo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
