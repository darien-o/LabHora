"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DollarSign, Plus, Pencil, Trash2, RefreshCw, Check,
  AlertCircle, TrendingUp, Wallet,
} from "lucide-react";
import { fetchRecaudos, postRecaudo } from "@/lib/api-client";

interface Recaudo {
  rowIndex: number;
  month: string; // YYYY-MM
  amount: number;
  description: string;
  createdAt: string;
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
};

function formatMonth(m: string): string {
  const [yr, mo] = m.split("-");
  return `${MONTH_LABELS[mo] || mo} ${yr}`;
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export function AdminRecaudos() {
  const [recaudos, setRecaudos] = useState<Recaudo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [formMonth, setFormMonth] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formError, setFormError] = useState("");

  // Delete confirm
  const [deleteRow, setDeleteRow] = useState<Recaudo | null>(null);

  useEffect(() => { load() }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchRecaudos();
      if (!data.error) setRecaudos(data);
    } catch {} finally { setLoading(false); }
  };

  const totalYear = useMemo(() => {
    const yr = new Date().getFullYear().toString();
    return recaudos.filter((r) => r.month.startsWith(yr)).reduce((t, r) => t + r.amount, 0);
  }, [recaudos]);

  const openAdd = () => {
    const now = new Date();
    setEditingRow(null);
    setFormMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setFormAmount("");
    setFormDesc("");
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (r: Recaudo) => {
    setEditingRow(r.rowIndex);
    setFormMonth(r.month);
    setFormAmount(String(r.amount));
    setFormDesc(r.description);
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formMonth || !formAmount) { setFormError("Mes y monto son requeridos."); return; }
    const amount = parseFloat(formAmount.replace(/[^0-9.]/g, ""));
    if (isNaN(amount) || amount <= 0) { setFormError("Ingresa un monto válido."); return; }

    setSaving(true); setFormError("");
    try {
      if (editingRow) {
        await postRecaudo({ action: "edit", rowIndex: editingRow, month: formMonth, amount, description: formDesc });
      } else {
        await postRecaudo({ action: "add", month: formMonth, amount, description: formDesc });
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) { setFormError(e.message || "Error al guardar."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setSaving(true);
    try {
      await postRecaudo({ action: "delete", rowIndex: deleteRow.rowIndex });
      setDeleteRow(null);
      await load();
    } catch {} finally { setSaving(false); }
  };

  const sorted = useMemo(() => [...recaudos].sort((a, b) => b.month.localeCompare(a.month)), [recaudos]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              Recaudos Mensuales
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={load} disabled={loading} className="h-10 w-10 p-0">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button onClick={openAdd} className="h-10 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Year total */}
          {totalYear > 0 && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <span className="text-base font-medium text-emerald-900">Total {new Date().getFullYear()}:</span>
              </div>
              <span className="text-xl font-bold text-emerald-700">{formatCOP(totalYear)}</span>
            </div>
          )}

          <p className="text-sm text-gray-600">
            El recaudo del mes se usa para calcular el valor hora de los cuidadores con tarifa variable.
            Los cuidadores con pago fijo se pagan primero, y el resto se reparte proporcionalmente.
          </p>

          {/* List */}
          {loading && recaudos.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-base text-gray-500">No hay recaudos registrados</p>
              <p className="text-sm text-gray-400 mt-1">Agrega el primer recaudo del mes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((r) => (
                <div key={r.rowIndex} className="flex items-center justify-between p-4 rounded-xl border bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-sm font-medium">{formatMonth(r.month)}</Badge>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{formatCOP(r.amount)}</p>
                    {r.description && <p className="text-sm text-gray-600 mt-0.5 truncate">{r.description}</p>}
                    {r.createdAt && <p className="text-xs text-gray-400 mt-0.5">Registrado: {r.createdAt}</p>}
                  </div>
                  <div className="flex gap-1 ml-3 shrink-0">
                    <Button variant="ghost" onClick={() => openEdit(r)} className="h-10 w-10 p-0 text-gray-500 hover:text-blue-600">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleteRow(r)} className="h-10 w-10 p-0 text-gray-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-emerald-600" />
              {editingRow ? "Editar Recaudo" : "Nuevo Recaudo"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Ingresa el monto recaudado para el mes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium text-gray-700">Mes</Label>
              <Input type="month" value={formMonth} onChange={(e) => setFormMonth(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Monto (COP)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Ej: 3000000"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value.replace(/[^0-9]/g, ""))}
                className="mt-1 text-lg font-mono"
              />
              {formAmount && !isNaN(parseFloat(formAmount)) && (
                <p className="text-sm text-emerald-700 mt-1">{formatCOP(parseFloat(formAmount))}</p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Descripción (opcional)</Label>
              <Input
                type="text"
                placeholder="Ej: Pago mensual familia"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="mt-1"
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />{formError}</p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-12 text-base">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="h-12 text-base bg-emerald-600 hover:bg-emerald-700">
              {saving ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              {editingRow ? "Guardar Cambios" : "Agregar Recaudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteRow} onOpenChange={(open) => { if (!open) setDeleteRow(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">¿Eliminar recaudo?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-700">
              {deleteRow && <>Se eliminará el recaudo de <strong>{formatMonth(deleteRow.month)}</strong> por <strong>{formatCOP(deleteRow.amount)}</strong>.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-12 text-base">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="h-12 text-base bg-red-600 hover:bg-red-700">
              {saving ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
