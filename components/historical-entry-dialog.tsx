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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Clock, AlertTriangle } from "lucide-react";
import { toLocalISO, parseSpanishDateTime } from "@/lib/utils";

interface Person {
  id: string;
  name: string;
}

interface TimeEntry {
  id: string;
  personName: string;
  clockIn: string;  // "DD/MM/YYYY, HH:mm:ss" or legacy "D/M/YYYY H:mm:ss"
  clockOut?: string;
  date: string;
}

interface HistoricalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person | null;
  onConfirm: (clockIn: string, clockOut: string) => void;
  timeEntries: TimeEntry[];
}

export function HistoricalEntryDialog({
  open,
  onOpenChange,
  person,
  onConfirm,
  timeEntries,
}: HistoricalEntryDialogProps) {
  const [clockInDate, setClockInDate] = useState("");
  const [clockInTime, setClockInTime] = useState("");
  const [clockOutTime, setClockOutTime] = useState("");
  const [error, setError] = useState("");

  /** Format a picked date+time for display only — no TZ issue since it's purely presentational. */
  const formatDateTime = (dateStr: string, timeStr: string) => {
    const date = new Date(`${dateStr}T${timeStr}`);
    return (
      date.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) +
      " a las " +
      date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true })
    );
  };

  /**
   * Check for time-range overlaps with existing entries.
   * entry.clockIn / clockOut are in the Spanish sheet format, so we use
   * parseSpanishDateTime — not new Date() which only handles ISO strings.
   */
  const checkForConflicts = (clockIn: Date, clockOut: Date) => {
    if (!person) return null;

    const conflictingEntry = timeEntries.find((entry) => {
      if (entry.personName === person.name) return false;
      const entryStart = parseSpanishDateTime(entry.clockIn);
      const entryEnd = entry.clockOut ? parseSpanishDateTime(entry.clockOut) : new Date();
      if (!entryStart || !entryEnd) return false;
      return clockIn < entryEnd && clockOut > entryStart;
    });

    if (!conflictingEntry) return null;

    const conflictStart = parseSpanishDateTime(conflictingEntry.clockIn);
    const conflictEnd = conflictingEntry.clockOut
      ? parseSpanishDateTime(conflictingEntry.clockOut)
      : new Date();

    if (!conflictStart || !conflictEnd) return null;

    const startStr =
      conflictStart.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) +
      " a las " +
      conflictStart.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true });
    const endStr = conflictEnd.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true });

    return `${conflictingEntry.personName} ya tiene un registro desde ${startStr} hasta ${endStr}${
      conflictingEntry.clockOut ? "" : " (en curso)"
    }.`;
  };

  const validateAndSubmit = () => {
    setError("");

    if (!clockInDate || !clockInTime || !clockOutTime) {
      setError("Por favor completa todos los campos");
      return;
    }

    // Use local Date for validation comparisons (duration, future check)
    const clockInDateTime = new Date(`${clockInDate}T${clockInTime}`);
    const clockOutDateTime = new Date(`${clockInDate}T${clockOutTime}`);

    if (clockInDateTime >= clockOutDateTime) {
      setError("La hora de salida debe ser posterior a la de entrada");
      return;
    }

    const hours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
    if (hours > 24) {
      setError("El turno no puede ser mayor a 24 horas");
      return;
    }

    if (clockInDateTime > new Date()) {
      setError("No se pueden crear registros para fechas futuras");
      return;
    }

    const conflictMessage = checkForConflicts(clockInDateTime, clockOutDateTime);
    if (conflictMessage) {
      setError(conflictMessage);
      return;
    }

    // toLocalISO converts the user's local wall-clock time to ISO/UTC for the server
    onConfirm(toLocalISO(clockInDate, clockInTime), toLocalISO(clockInDate, clockOutTime));
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    setClockInDate("");
    setClockInTime("");
    setClockOutTime("");
    setError("");
  };

  const calculateDuration = () => {
    if (!clockInDate || !clockInTime || !clockOutTime) return "";
    const clockIn = new Date(`${clockInDate}T${clockInTime}`);
    const clockOut = new Date(`${clockInDate}T${clockOutTime}`);
    if (clockIn >= clockOut) return "Inválido";
    const hours = Math.round(((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)) * 10) / 10;
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Registro Histórico
          </DialogTitle>
          <DialogDescription>
            Alguien más está fichado actualmente. Crea un registro histórico
            para <strong>{person?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Fecha
            </Label>
            <div>
              <Label htmlFor="clockin-date" className="text-xs text-gray-600">Fecha</Label>
              <Input
                id="clockin-date"
                type="date"
                value={clockInDate}
                onChange={(e) => setClockInDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hora de Entrada y Salida
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="clockin-time" className="text-xs text-gray-600">Hora de Entrada</Label>
                <Input
                  id="clockin-time"
                  type="time"
                  value={clockInTime}
                  onChange={(e) => setClockInTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="clockout-time" className="text-xs text-gray-600">Hora de Salida</Label>
                <Input
                  id="clockout-time"
                  type="time"
                  value={clockOutTime}
                  onChange={(e) => setClockOutTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {calculateDuration() && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Duración:</strong> {calculateDuration()}
              </p>
              {clockInDate && clockInTime && clockOutTime && (
                <p className="text-xs text-blue-600 mt-1">
                  Del {formatDateTime(clockInDate, clockInTime)} al{" "}
                  {formatDateTime(clockInDate, clockOutTime)}
                </p>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{error}</p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={validateAndSubmit} className="bg-blue-600 hover:bg-blue-700">
            Crear Registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
