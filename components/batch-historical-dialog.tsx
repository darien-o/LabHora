"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Send,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface Person {
  id: string;
  name: string;
}

interface TimeEntry {
  id: string;
  personName: string;
  clockIn: string;
  clockOut?: string;
  date: string;
}

interface PendingEntry {
  id: string;
  date: string;
  clockInTime: string;
  clockOutTime: string;
  status: "pending" | "sending" | "success" | "error";
  errorMessage?: string;
}

interface BatchHistoricalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: Person[];
  timeEntries: TimeEntry[];
  onSubmitEntry: (
    personName: string,
    clockIn: string,
    clockOut: string
  ) => Promise<void>;
  onComplete: () => void;
}

export function BatchHistoricalDialog({
  open,
  onOpenChange,
  people,
  timeEntries,
  onSubmitEntry,
  onComplete,
}: BatchHistoricalDialogProps) {
  const [selectedPerson, setSelectedPerson] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [currentClockIn, setCurrentClockIn] = useState("08:00");
  const [currentClockOut, setCurrentClockOut] = useState("17:00");
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const totalDuration = useMemo(() => {
    let totalMinutes = 0;
    for (const entry of entries) {
      const [inH, inM] = entry.clockInTime.split(":").map(Number);
      const [outH, outM] = entry.clockOutTime.split(":").map(Number);
      totalMinutes += (outH * 60 + outM) - (inH * 60 + inM);
    }
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }, [entries]);

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  };

  const getEntryDuration = (clockIn: string, clockOut: string) => {
    const [inH, inM] = clockIn.split(":").map(Number);
    const [outH, outM] = clockOut.split(":").map(Number);
    const mins = (outH * 60 + outM) - (inH * 60 + inM);
    if (mins <= 0) return "Inválido";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const validateEntry = (date: string, clockIn: string, clockOut: string): string | null => {
    if (!selectedPerson) return "Selecciona un cuidador primero";
    if (!date) return "Selecciona una fecha";
    if (!clockIn || !clockOut) return "Completa las horas de entrada y salida";

    const clockInDT = new Date(`${date}T${clockIn}`);
    const clockOutDT = new Date(`${date}T${clockOut}`);

    if (clockInDT >= clockOutDT) return "La hora de salida debe ser posterior a la de entrada";
    if (clockInDT > new Date()) return "No se pueden crear registros para fechas futuras";

    // Check duplicate in pending list
    const duplicate = entries.find((e) => e.date === date && e.status !== "error");
    if (duplicate) return `Ya tienes una entrada para ${getDayName(date)} en la lista`;

    return null;
  };

  const addEntry = () => {
    setError("");
    const validationError = validateEntry(currentDate, currentClockIn, currentClockOut);
    if (validationError) {
      setError(validationError);
      return;
    }

    const newEntry: PendingEntry = {
      id: `${currentDate}-${Date.now()}`,
      date: currentDate,
      clockInTime: currentClockIn,
      clockOutTime: currentClockOut,
      status: "pending",
    };

    setEntries((prev) =>
      [...prev, newEntry].sort((a, b) => a.date.localeCompare(b.date))
    );

    // Advance date to next weekday for quick multi-day entry
    const nextDate = new Date(currentDate + "T12:00:00");
    nextDate.setDate(nextDate.getDate() + 1);
    // Skip weekends
    while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    const nextDateStr = nextDate.toISOString().split("T")[0];
    if (nextDateStr <= today) {
      setCurrentDate(nextDateStr);
    }
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const duplicateLastTimes = () => {
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      setCurrentClockIn(last.clockInTime);
      setCurrentClockOut(last.clockOutTime);
    }
  };

  const submitAll = async () => {
    if (entries.length === 0 || !selectedPerson) return;

    setIsSubmitting(true);
    const pendingEntries = entries.filter((e) => e.status === "pending" || e.status === "error");

    for (const entry of pendingEntries) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status: "sending" as const } : e))
      );

      try {
        const clockIn = new Date(`${entry.date}T${entry.clockInTime}`).toISOString();
        const clockOut = new Date(`${entry.date}T${entry.clockOutTime}`).toISOString();
        await onSubmitEntry(selectedPerson, clockIn, clockOut);

        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, status: "success" as const } : e))
        );
      } catch (err: any) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, status: "error" as const, errorMessage: err.message || "Error desconocido" }
              : e
          )
        );
      }
    }

    setIsSubmitting(false);
  };

  const handleClose = () => {
    const hasSuccess = entries.some((e) => e.status === "success");
    if (hasSuccess) onComplete();
    onOpenChange(false);
    // Reset state
    setSelectedPerson("");
    setCurrentDate("");
    setCurrentClockIn("08:00");
    setCurrentClockOut("17:00");
    setEntries([]);
    setError("");
    setIsSubmitting(false);
  };

  const pendingCount = entries.filter((e) => e.status === "pending" || e.status === "error").length;
  const successCount = entries.filter((e) => e.status === "success").length;
  const allDone = entries.length > 0 && pendingCount === 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Registros Históricos por Lote
          </DialogTitle>
          <DialogDescription>
            Agrega múltiples días de trabajo pasados de forma rápida. Selecciona
            el cuidador, agrega las fechas y envía todo de una vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Person selector */}
          <div>
            <Label className="text-sm font-medium">Cuidador</Label>
            <Select
              value={selectedPerson}
              onValueChange={setSelectedPerson}
              disabled={isSubmitting}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar cuidador" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entry form */}
          <div className="p-3 border rounded-lg bg-gray-50 space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Agregar día
            </Label>

            <div>
              <Label htmlFor="batch-date" className="text-xs text-gray-600">
                Fecha
              </Label>
              <Input
                id="batch-date"
                type="date"
                max={today}
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="batch-in" className="text-xs text-gray-600">
                  Entrada
                </Label>
                <Input
                  id="batch-in"
                  type="time"
                  value={currentClockIn}
                  onChange={(e) => setCurrentClockIn(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="batch-out" className="text-xs text-gray-600">
                  Salida
                </Label>
                <Input
                  id="batch-out"
                  type="time"
                  value={currentClockOut}
                  onChange={(e) => setCurrentClockOut(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={addEntry}
                disabled={isSubmitting}
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar a la lista
              </Button>
              {entries.length > 0 && (
                <Button
                  onClick={duplicateLastTimes}
                  disabled={isSubmitting}
                  size="sm"
                  variant="outline"
                  title="Usar mismas horas del último registro"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Pending entries list */}
          {entries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Registros ({entries.length})
                </Label>
                <span className="text-xs text-gray-500">
                  Total: {totalDuration}
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                      entry.status === "success"
                        ? "bg-green-50 border border-green-200"
                        : entry.status === "error"
                        ? "bg-red-50 border border-red-200"
                        : entry.status === "sending"
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-white border"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {entry.status === "success" && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      )}
                      {entry.status === "error" && (
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      {entry.status === "sending" && (
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                      )}
                      <span className="font-medium capitalize truncate">
                        {getDayName(entry.date)}
                      </span>
                      <span className="text-gray-500 shrink-0">
                        {entry.clockInTime} → {entry.clockOutTime}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {getEntryDuration(entry.clockInTime, entry.clockOutTime)}
                      </Badge>
                    </div>

                    {entry.status === "pending" && !isSubmitting && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                        onClick={() => removeEntry(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {entry.status === "error" && (
                      <span className="text-[10px] text-red-600 ml-1 truncate max-w-[120px]">
                        {entry.errorMessage}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {successCount > 0 && (
                <p className="text-xs text-green-600 text-center">
                  {successCount} de {entries.length} registros guardados
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            {allDone ? "Cerrar" : "Cancelar"}
          </Button>
          {!allDone && (
            <Button
              onClick={submitAll}
              disabled={pendingCount === 0 || isSubmitting || !selectedPerson}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              {isSubmitting
                ? "Enviando..."
                : `Enviar ${pendingCount} registro${pendingCount !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
