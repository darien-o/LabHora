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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Layers,
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { ConflictDialog } from "@/components/conflict-dialog";
import { detectConflicts, type ConflictResult } from "@/lib/conflict-detector";
import { useAdmin } from "@/lib/admin-context";
import { getNextCalendarDay } from "@/lib/schedule-utils";
import { postExpense } from "@/lib/api-client";

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
  note: string;
  status: "pending" | "sending" | "success" | "error";
  errorMessage?: string;
  addedAt: number;
}

interface ExpenseItem {
  type: "expense" | "income";
  amount: string;
  description: string;
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

  // Auto-detect person
  const [selectedPerson, setSelectedPerson] = useState(currentPersonName || "");
  const [batchMode, setBatchMode] = useState(false);

  // Form state
  const [currentDate, setCurrentDate] = useState("");
  const [currentClockIn, setCurrentClockIn] = useState("08:00");
  const [currentClockOut, setCurrentClockOut] = useState("17:00");
  const [currentNote, setCurrentNote] = useState("");
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [newExpenseType, setNewExpenseType] = useState<"expense" | "income">("expense");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseDesc, setNewExpenseDesc] = useState("");

  // Batch entries
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Conflict dialog
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictResult[]>([]);
  const [pendingEntryData, setPendingEntryData] = useState<{
    date: string;
    clockIn: string;
    clockOut: string;
  } | null>(null);

  const today = new Date().toISOString().split("T")[0];

  // Auto-select person on open
  useEffect(() => {
    if (open && currentPersonName) {
      setSelectedPerson(currentPersonName);
    }
  }, [open, currentPersonName]);

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
    if (clockOutDT > new Date())
      return "La hora de salida debe ser anterior a la hora actual. Si necesitas programar un turno futuro, usa la pestaña «Programar».";

    // Check overlap with pending batch entries
    for (const e of entries) {
      if (e.id === editingId) continue;
      if (e.status === "error") continue;
      if (e.date !== date) continue;

      const eStart = new Date(`${e.date}T${e.clockInTime}`);
      const eEnd = new Date(`${e.date}T${e.clockOutTime}`);
      if (clockInDT < eEnd && clockOutDT > eStart) {
        return `Se cruza con otro registro en la lista: ${e.clockInTime} → ${e.clockOutTime}`;
      }
    }

    return null;
  };

  const handleAddExpense = () => {
    const amount = parseFloat(newExpenseAmount);
    if (!newExpenseDesc.trim() || isNaN(amount) || amount <= 0) return;
    setExpenses((prev) => [...prev, { type: newExpenseType, amount: newExpenseAmount, description: newExpenseDesc.trim() }]);
    setNewExpenseAmount("");
    setNewExpenseDesc("");
  };

  const removeExpense = (idx: number) => {
    setExpenses((prev) => prev.filter((_, i) => i !== idx));
  };

  const checkConflictsAndSubmit = () => {
    setError("");
    const validationError = validateEntry(currentDate, currentClockIn, currentClockOut);
    if (validationError) { setError(validationError); return; }

    const newStart = new Date(`${currentDate}T${currentClockIn}`);
    const newEnd = new Date(`${currentDate}T${currentClockOut}`);

    const conflicts = detectConflicts(selectedPerson, newStart, newEnd, timeEntries);

    if (conflicts.length > 0) {
      const samePersonConflicts = conflicts.filter((c) => c.type === "same-person");
      if (samePersonConflicts.length > 0) {
        setPendingConflicts(conflicts);
        setPendingEntryData({ date: currentDate, clockIn: currentClockIn, clockOut: currentClockOut });
        setShowConflictDialog(true);
        return;
      }
      setPendingConflicts(conflicts);
      setPendingEntryData({ date: currentDate, clockIn: currentClockIn, clockOut: currentClockOut });
      setShowConflictDialog(true);
      return;
    }

    if (batchMode) {
      doAddToBatch(currentDate, currentClockIn, currentClockOut);
    } else {
      doSubmitSingle();
    }
  };

  const doAddToBatch = (date: string, clockIn: string, clockOut: string) => {
    const newEntry: PendingEntry = {
      id: `${date}-${Date.now()}`,
      date,
      clockInTime: clockIn,
      clockOutTime: clockOut,
      note: currentNote,
      status: "pending",
      addedAt: Date.now(),
    };
    setEntries((prev) =>
      [...prev, newEntry].sort((a, b) =>
        a.date === b.date ? a.clockInTime.localeCompare(b.clockInTime) : a.date.localeCompare(b.date)
      )
    );
    // Advance date
    const nextDateStr = getNextCalendarDay(date);
    if (nextDateStr <= today) setCurrentDate(nextDateStr);
    setCurrentNote("");
    setExpenses([]);
  };

  const doSubmitSingle = async () => {
    setIsSubmitting(true);
    try {
      const clockIn = new Date(`${currentDate}T${currentClockIn}`).toISOString();
      const clockOut = new Date(`${currentDate}T${currentClockOut}`).toISOString();
      await onSubmitEntry(selectedPerson, clockIn, clockOut);

      // TODO: If expenses exist, we'd need the rowIndex of the created entry to associate them.
      // For now, expenses are informational — they can be added later from the history view.

      setCurrentNote("");
      setExpenses([]);
      onComplete();
      showSuccess();
    } catch (err: any) {
      setError(err.message || "Error al guardar el registro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [successMsg, setSuccessMsg] = useState("");
  const showSuccess = () => {
    setSuccessMsg("¡Registro guardado correctamente!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const submitBatch = async () => {
    if (entries.length === 0 || !selectedPerson) return;
    setIsSubmitting(true);
    const pendingEntries = entries.filter((e) => e.status === "pending" || e.status === "error");

    for (const entry of pendingEntries) {
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "sending" as const } : e));
      try {
        const clockIn = new Date(`${entry.date}T${entry.clockInTime}`).toISOString();
        const clockOut = new Date(`${entry.date}T${entry.clockOutTime}`).toISOString();
        await onSubmitEntry(selectedPerson, clockIn, clockOut);
        setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: "success" as const } : e));
      } catch (err: any) {
        setEntries((prev) => prev.map((e) =>
          e.id === entry.id ? { ...e, status: "error" as const, errorMessage: err.message || "Error" } : e
        ));
      }
    }
    setIsSubmitting(false);
  };

  const handleConflictForce = () => {
    if (!pendingEntryData) return;
    setShowConflictDialog(false);
    for (const conflict of pendingConflicts) {
      if (conflict.type === "cross-person") {
        addAlert({
          type: "overlap-cross",
          message: `${selectedPerson} y ${conflict.existingPerson} cubren el mismo horario el ${pendingEntryData.date}.`,
          personName: selectedPerson,
          otherPerson: conflict.existingPerson,
          date: pendingEntryData.date,
        });
      }
    }
    if (batchMode) {
      doAddToBatch(pendingEntryData.date, pendingEntryData.clockIn, pendingEntryData.clockOut);
    } else {
      doSubmitSingle();
    }
  };

  const handleClose = () => {
    const hasSuccess = entries.some((e) => e.status === "success") || successMsg !== "";
    if (hasSuccess) onComplete();
    onOpenChange(false);
    setSelectedPerson(currentPersonName || "");
    setCurrentDate("");
    setCurrentClockIn("08:00");
    setCurrentClockOut("17:00");
    setCurrentNote("");
    setExpenses([]);
    setEntries([]);
    setError("");
    setSuccessMsg("");
    setIsSubmitting(false);
    setBatchMode(false);
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
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

  const pendingCount = entries.filter((e) => e.status === "pending" || e.status === "error").length;
  const successCount = entries.filter((e) => e.status === "success").length;
  const allDone = entries.length > 0 && pendingCount === 0 && !isSubmitting;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Registrar Día Trabajado
            </DialogTitle>
            <DialogDescription>
              Registra un horario de trabajo pasado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Person — auto-detected, only admin can change */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                  {selectedPerson.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-gray-900">{selectedPerson || "Sin seleccionar"}</span>
              </div>
              {isAdmin && (
                <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Cambiar" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.name} className="text-sm">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Batch mode toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Modo por lotes</span>
              </div>
              <Switch checked={batchMode} onCheckedChange={setBatchMode} aria-label="Activar modo por lotes" />
            </div>

            {/* Entry form */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="hist-date" className="text-sm font-medium text-gray-700">Fecha</Label>
                <Input
                  id="hist-date"
                  type="date"
                  max={today}
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="hist-in" className="text-sm font-medium text-gray-700">Entrada</Label>
                  <Input
                    id="hist-in"
                    type="time"
                    value={currentClockIn}
                    onChange={(e) => setCurrentClockIn(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="hist-out" className="text-sm font-medium text-gray-700">Salida</Label>
                  <Input
                    id="hist-out"
                    type="time"
                    value={currentClockOut}
                    onChange={(e) => setCurrentClockOut(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <Label htmlFor="hist-note" className="text-sm font-medium text-gray-700">Nota (opcional)</Label>
                <textarea
                  id="hist-note"
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  placeholder="Ej: Turno normal, sin novedades..."
                  className="w-full min-h-[50px] p-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 mt-1"
                  disabled={isSubmitting}
                />
              </div>

              {/* Expenses/Income section */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Receipt className="h-4 w-4" />
                  Gastos o ingresos (opcional)
                </Label>

                {expenses.length > 0 && (
                  <div className="space-y-1">
                    {expenses.map((exp, idx) => (
                      <div key={idx} className={`flex items-center justify-between rounded px-2 py-1 text-sm ${exp.type === "expense" ? "bg-red-50" : "bg-green-50"}`}>
                        <div className="flex items-center gap-1.5">
                          {exp.type === "expense"
                            ? <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />
                            : <ArrowDownCircle className="h-3.5 w-3.5 text-green-500" />}
                          <span className="truncate">{exp.description}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium ${exp.type === "expense" ? "text-red-700" : "text-green-700"}`}>
                            ${parseFloat(exp.amount).toLocaleString()}
                          </span>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeExpense(idx)}>
                            <Trash2 className="h-3 w-3 text-gray-400" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5 items-end">
                  <Select value={newExpenseType} onValueChange={(v) => setNewExpenseType(v as "expense" | "income")}>
                    <SelectTrigger className="w-[90px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Gasto</SelectItem>
                      <SelectItem value="income">Ingreso</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Monto"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                    className="h-8 w-20 text-xs"
                    min="0"
                  />
                  <Input
                    placeholder="Descripción"
                    value={newExpenseDesc}
                    onChange={(e) => setNewExpenseDesc(e.target.value)}
                    className="h-8 flex-1 text-xs"
                  />
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleAddExpense}
                    disabled={!newExpenseDesc.trim() || !newExpenseAmount || parseFloat(newExpenseAmount) <= 0}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success */}
            {successMsg && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{successMsg}</AlertDescription>
              </Alert>
            )}

            {/* Action button — single mode */}
            {!batchMode && (
              <Button
                onClick={checkConflictsAndSubmit}
                disabled={isSubmitting || !selectedPerson}
                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Check className="h-5 w-5 mr-2" />
                )}
                {isSubmitting ? "Guardando..." : "Guardar Registro"}
              </Button>
            )}

            {/* Batch mode — add to list + list + send */}
            {batchMode && (
              <>
                <div className="flex gap-2">
                  <Button
                    onClick={checkConflictsAndSubmit}
                    disabled={isSubmitting}
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar a la lista
                  </Button>
                  {entries.length > 0 && (
                    <Button
                      onClick={() => {
                        if (entries.length > 0) {
                          const last = entries[entries.length - 1];
                          setCurrentClockIn(last.clockInTime);
                          setCurrentClockOut(last.clockOutTime);
                        }
                      }}
                      size="sm"
                      variant="outline"
                      title="Copiar horas del último"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {entries.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Registros ({entries.length})</Label>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                            entry.status === "success" ? "bg-green-50 border border-green-200"
                            : entry.status === "error" ? "bg-red-50 border border-red-200"
                            : entry.status === "sending" ? "bg-blue-50 border border-blue-200"
                            : "bg-white border"
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {entry.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                            {entry.status === "error" && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                            {entry.status === "sending" && <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />}
                            <span className="font-medium capitalize truncate">{getDayName(entry.date)}</span>
                            <span className="text-gray-500 shrink-0">{entry.clockInTime} → {entry.clockOutTime}</span>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {getEntryDuration(entry.clockInTime, entry.clockOutTime)}
                            </Badge>
                          </div>
                          {entry.status === "pending" && !isSubmitting && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                              onClick={() => setEntries((prev) => prev.filter((e) => e.id !== entry.id))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!allDone && (
                      <Button
                        onClick={submitBatch}
                        disabled={pendingCount === 0 || isSubmitting || !selectedPerson}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        {isSubmitting ? "Enviando..." : `Enviar ${pendingCount} registro${pendingCount !== 1 ? "s" : ""}`}
                      </Button>
                    )}
                    {successCount > 0 && (
                      <p className="text-xs text-green-600 text-center">
                        {successCount} de {entries.length} registros guardados
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {allDone || successMsg ? "Cerrar" : "Cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConflictDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={pendingConflicts}
        personName={selectedPerson}
        onAdjust={() => setShowConflictDialog(false)}
        onForceWithAlert={handleConflictForce}
        onCancel={() => setShowConflictDialog(false)}
      />
    </>
  );
}
