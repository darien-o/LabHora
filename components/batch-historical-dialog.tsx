"use client";

import { useState, useMemo, useEffect } from "react";
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
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  Send,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  Check,
} from "lucide-react";
import { ConflictDialog } from "@/components/conflict-dialog";
import { detectConflicts, type ConflictResult } from "@/lib/conflict-detector";
import { useAdmin } from "@/lib/admin-context";
import { getNextCalendarDay } from "@/lib/schedule-utils";

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
  addedAt: number; // timestamp for edit window
}

interface BatchHistoricalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: Person[];
  timeEntries: TimeEntry[];
  currentPersonName?: string;
  onSubmitEntry: (
    personName: string,
    clockIn: string,
    clockOut: string
  ) => Promise<void>;
  onComplete: () => void;
}

const EDIT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes edit window for non-admin

export function BatchHistoricalDialog({
  open,
  onOpenChange,
  people,
  timeEntries,
  currentPersonName,
  onSubmitEntry,
  onComplete,
}: BatchHistoricalDialogProps) {
  const { isAdmin, addAlert } = useAdmin();
  const [selectedPerson, setSelectedPerson] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [currentClockIn, setCurrentClockIn] = useState("08:00");
  const [currentClockOut, setCurrentClockOut] = useState("17:00");
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState("");

  // Conflict dialog state
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // Preselect caregiver matching the active session profile
  useEffect(() => {
    if (open && currentPersonName && !selectedPerson) {
      const match = people.find((p) => p.name === currentPersonName);
      if (match) setSelectedPerson(match.name);
    }
  }, [open, currentPersonName, people, selectedPerson]);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictResult[]>([]);
  const [pendingEntryData, setPendingEntryData] = useState<{
    date: string;
    clockIn: string;
    clockOut: string;
  } | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const totalDuration = useMemo(() => {
    let totalMinutes = 0;
    for (const entry of entries) {
      const [inH, inM] = entry.clockInTime.split(":").map(Number);
      const [outH, outM] = entry.clockOutTime.split(":").map(Number);
      totalMinutes += outH * 60 + outM - (inH * 60 + inM);
    }
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }, [entries]);

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const getEntryDuration = (clockIn: string, clockOut: string) => {
    const [inH, inM] = clockIn.split(":").map(Number);
    const [outH, outM] = clockOut.split(":").map(Number);
    const mins = outH * 60 + outM - (inH * 60 + inM);
    if (mins <= 0) return "Inválido";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const canEditEntry = (entry: PendingEntry): boolean => {
    if (isAdmin) return true;
    if (entry.status !== "pending") return false;
    return Date.now() - entry.addedAt < EDIT_WINDOW_MS;
  };

  const validateEntry = (
    date: string,
    clockIn: string,
    clockOut: string
  ): string | null => {
    if (!selectedPerson) return "Selecciona un cuidador primero";
    if (!date) return "Selecciona una fecha";
    if (!clockIn || !clockOut) return "Completa las horas de entrada y salida";

    const clockInDT = new Date(`${date}T${clockIn}`);
    const clockOutDT = new Date(`${date}T${clockOut}`);

    if (clockInDT >= clockOutDT)
      return "La hora de salida debe ser posterior a la de entrada";
    if (clockInDT > new Date())
      return "No se pueden crear registros para fechas futuras";

    // Check overlap with OTHER pending entries for same person on same day
    const newStart = clockInDT;
    const newEnd = clockOutDT;
    for (const e of entries) {
      if (e.id === editingId) continue; // skip the one being edited
      if (e.status === "error") continue;
      if (e.date !== date) continue;

      const eStart = new Date(`${e.date}T${e.clockInTime}`);
      const eEnd = new Date(`${e.date}T${e.clockOutTime}`);
      if (newStart < eEnd && newEnd > eStart) {
        return `Se cruza con otro registro en la lista: ${e.clockInTime} → ${e.clockOutTime}`;
      }
    }

    return null;
  };

  const checkConflictsAndAdd = () => {
    setError("");
    const validationError = validateEntry(
      currentDate,
      currentClockIn,
      currentClockOut
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    const newStart = new Date(`${currentDate}T${currentClockIn}`);
    const newEnd = new Date(`${currentDate}T${currentClockOut}`);

    // Check conflicts with existing time entries in the system
    const conflicts = detectConflicts(
      selectedPerson,
      newStart,
      newEnd,
      timeEntries
    );

    if (conflicts.length > 0) {
      const samePersonConflicts = conflicts.filter(
        (c) => c.type === "same-person"
      );

      // Same-person conflicts always block (must adjust)
      if (samePersonConflicts.length > 0) {
        setPendingConflicts(conflicts);
        setPendingEntryData({
          date: currentDate,
          clockIn: currentClockIn,
          clockOut: currentClockOut,
        });
        setShowConflictDialog(true);
        return;
      }

      // Cross-person conflicts: show warning, allow force
      setPendingConflicts(conflicts);
      setPendingEntryData({
        date: currentDate,
        clockIn: currentClockIn,
        clockOut: currentClockOut,
      });
      setShowConflictDialog(true);
      return;
    }

    // No conflicts, add directly
    doAddEntry(currentDate, currentClockIn, currentClockOut);
  };

  const doAddEntry = (date: string, clockIn: string, clockOut: string) => {
    if (editingId) {
      // Update existing entry
      setEntries((prev) =>
        prev
          .map((e) =>
            e.id === editingId
              ? { ...e, date, clockInTime: clockIn, clockOutTime: clockOut }
              : e
          )
          .sort((a, b) =>
            a.date === b.date
              ? a.clockInTime.localeCompare(b.clockInTime)
              : a.date.localeCompare(b.date)
          )
      );
      setEditingId(null);
    } else {
      const newEntry: PendingEntry = {
        id: `${date}-${Date.now()}`,
        date,
        clockInTime: clockIn,
        clockOutTime: clockOut,
        status: "pending",
        addedAt: Date.now(),
      };
      setEntries((prev) =>
        [...prev, newEntry].sort((a, b) =>
          a.date === b.date
            ? a.clockInTime.localeCompare(b.clockInTime)
            : a.date.localeCompare(b.date)
        )
      );
    }

    // Advance date to next calendar day (including weekends)
    const nextDateStr = getNextCalendarDay(date);
    if (nextDateStr <= today) {
      setCurrentDate(nextDateStr);
    }
    setCurrentNote("");
  };

  const handleConflictAdjust = () => {
    setShowConflictDialog(false);
    // Keep the form as-is so user can adjust
  };

  const handleConflictForce = () => {
    if (!pendingEntryData) return;
    setShowConflictDialog(false);

    // Create admin alerts for cross-person conflicts
    for (const conflict of pendingConflicts) {
      if (conflict.type === "cross-person") {
        addAlert({
          type: "overlap-cross",
          message: `${selectedPerson} y ${conflict.existingPerson} cubren el mismo horario el ${pendingEntryData.date}. ${selectedPerson}: ${pendingEntryData.clockIn}–${pendingEntryData.clockOut}, ${conflict.existingPerson}: ${conflict.existingStart.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}–${conflict.existingEnd.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`,
          personName: selectedPerson,
          otherPerson: conflict.existingPerson,
          date: pendingEntryData.date,
        });
      }
    }

    doAddEntry(
      pendingEntryData.date,
      pendingEntryData.clockIn,
      pendingEntryData.clockOut
    );
  };

  const handleConflictCancel = () => {
    setShowConflictDialog(false);
  };

  const startEdit = (entry: PendingEntry) => {
    setEditingId(entry.id);
    setCurrentDate(entry.date);
    setCurrentClockIn(entry.clockInTime);
    setCurrentClockOut(entry.clockOutTime);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCurrentDate("");
    setCurrentClockIn("08:00");
    setCurrentClockOut("17:00");
    setCurrentNote("");
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) cancelEdit();
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
    const pendingEntries = entries.filter(
      (e) => e.status === "pending" || e.status === "error"
    );

    for (const entry of pendingEntries) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, status: "sending" as const } : e
        )
      );

      try {
        const clockIn = new Date(
          `${entry.date}T${entry.clockInTime}`
        ).toISOString();
        const clockOut = new Date(
          `${entry.date}T${entry.clockOutTime}`
        ).toISOString();
        await onSubmitEntry(selectedPerson, clockIn, clockOut);

        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, status: "success" as const } : e
          )
        );
      } catch (err: any) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  status: "error" as const,
                  errorMessage: err.message || "Error desconocido",
                }
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
    setSelectedPerson("");
    setCurrentDate("");
    setCurrentClockIn("08:00");
    setCurrentClockOut("17:00");
    setCurrentNote("");
    setEntries([]);
    setError("");
    setIsSubmitting(false);
    setEditingId(null);
  };

  const pendingCount = entries.filter(
    (e) => e.status === "pending" || e.status === "error"
  ).length;
  const successCount = entries.filter((e) => e.status === "success").length;
  const allDone = entries.length > 0 && pendingCount === 0 && !isSubmitting;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Registros Históricos por Lote
            </DialogTitle>
            <DialogDescription>
              Agrega múltiples registros de trabajo pasados. Puedes agregar
              varios horarios para el mismo día.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Person selector — avatar grid */}
            <div>
              <Label className="text-sm font-medium">Cuidador</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {people.map((p) => {
                  const isSelected = selectedPerson === p.name;
                  const initial = p.name.charAt(0).toUpperCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setSelectedPerson(p.name)}
                      className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      } ${isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                          isSelected
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {initial}
                      </div>
                      <span className="text-xs font-medium text-center leading-tight truncate w-full">
                        {p.name}
                      </span>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Entry form */}
            <div
              className={`p-3 border rounded-lg space-y-3 ${editingId ? "bg-yellow-50 border-yellow-300" : "bg-gray-50"}`}
            >
              <Label className="text-sm font-medium flex items-center gap-2">
                {editingId ? (
                  <>
                    <Pencil className="h-4 w-4 text-yellow-600" />
                    Editando registro
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Agregar registro
                  </>
                )}
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

              {/* Notes */}
              <div>
                <Label htmlFor="batch-note" className="text-xs text-gray-600">
                  Nota (opcional)
                </Label>
                <textarea
                  id="batch-note"
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  placeholder="Ej: Turno normal, sin novedades..."
                  className="w-full min-h-[60px] p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={checkConflictsAndAdd}
                  disabled={isSubmitting}
                  size="sm"
                  className={`flex-1 ${editingId ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  {editingId ? (
                    <>
                      <Pencil className="h-4 w-4 mr-1" />
                      Guardar cambio
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar a la lista
                    </>
                  )}
                </Button>
                {editingId && (
                  <Button
                    onClick={cancelEdit}
                    size="sm"
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                )}
                {!editingId && entries.length > 0 && (
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
                        editingId === entry.id
                          ? "bg-yellow-100 border-2 border-yellow-400"
                          : entry.status === "success"
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
                        <Badge
                          variant="secondary"
                          className="text-[10px] shrink-0"
                        >
                          {getEntryDuration(
                            entry.clockInTime,
                            entry.clockOutTime
                          )}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canEditEntry(entry) && !isSubmitting && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                            onClick={() => startEdit(entry)}
                            title="Editar"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {(entry.status === "pending" || (isAdmin && entry.status !== "sending")) &&
                          !isSubmitting && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                              onClick={() => removeEntry(entry.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                      </div>

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
                disabled={
                  pendingCount === 0 || isSubmitting || !selectedPerson
                }
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

      <ConflictDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={pendingConflicts}
        personName={selectedPerson}
        onAdjust={handleConflictAdjust}
        onForceWithAlert={handleConflictForce}
        onCancel={handleConflictCancel}
      />
    </>
  );
}
