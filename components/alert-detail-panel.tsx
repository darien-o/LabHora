"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { postEditEntry } from "@/lib/api-client";
import { useAdmin } from "@/lib/admin-context";
import {
  AlertTriangle,
  UserX,
  Users,
  Clock,
  CalendarDays,
  Check,
  Pencil,
  Loader2,
} from "lucide-react";

export interface AdminAlertExtended {
  id: string;
  type:
    | "overlap-same"
    | "overlap-cross"
    | "inconsistency"
    | "no-show"
    | "multi-day";
  message: string;
  personName: string;
  otherPerson?: string;
  date: string;
  timestamp: string;
  resolved: boolean;
  entryRowIndex?: number;
  approvedBy?: string;
  approvalDate?: string;
}

interface AlertDetailPanelProps {
  alert: AdminAlertExtended;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}

export function AlertDetailPanel({
  alert,
  open,
  onOpenChange,
  onResolved,
}: AlertDetailPanelProps) {
  const { resolveAlert } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "overlap-same":
        return <UserX className="h-5 w-5 text-red-600" />;
      case "overlap-cross":
        return <Users className="h-5 w-5 text-orange-600" />;
      case "no-show":
        return <Clock className="h-5 w-5 text-purple-600" />;
      case "multi-day":
        return <CalendarDays className="h-5 w-5 text-blue-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getAlertLabel = (type: string) => {
    switch (type) {
      case "overlap-same":
        return "Cruce propio";
      case "overlap-cross":
        return "Cruce entre cuidadores";
      case "no-show":
        return "No se presentó";
      case "multi-day":
        return "Registro multi-día";
      default:
        return "Inconsistencia";
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case "overlap-same":
        return "bg-red-100 text-red-700";
      case "overlap-cross":
        return "bg-orange-100 text-orange-700";
      case "no-show":
        return "bg-purple-100 text-purple-700";
      case "multi-day":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const canEdit =
    alert.type === "inconsistency" || alert.type === "no-show";
  const canApprove =
    alert.type === "overlap-same" ||
    alert.type === "overlap-cross" ||
    alert.type === "inconsistency";

  const handleEdit = async () => {
    if (!alert.entryRowIndex || !clockIn || !clockOut) {
      setError("Completa ambos campos de hora.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await postEditEntry(alert.entryRowIndex, clockIn, clockOut);
      resolveAlert(alert.id);
      setEditing(false);
      setClockIn("");
      setClockOut("");
      onResolved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Error al editar el registro.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = () => {
    resolveAlert(alert.id);
    onResolved();
    onOpenChange(false);
  };

  const handleResolve = () => {
    resolveAlert(alert.id);
    onResolved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {getAlertIcon(alert.type)}
            Detalle de alerta
          </DialogTitle>
          <DialogDescription className="sr-only">
            Panel de detalle de la alerta con opciones de acción
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alert info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={getAlertColor(alert.type)}>
                {getAlertLabel(alert.type)}
              </Badge>
              {alert.resolved && (
                <Badge className="bg-green-100 text-green-700">Resuelta</Badge>
              )}
            </div>

            <p className="text-sm text-gray-800">{alert.message}</p>

            <div className="text-xs text-gray-500 space-y-0.5">
              <p>
                <strong>Cuidador:</strong> {alert.personName}
                {alert.otherPerson ? ` ↔ ${alert.otherPerson}` : ""}
              </p>
              <p>
                <strong>Fecha:</strong> {alert.date}
              </p>
              <p>
                <strong>Creada:</strong>{" "}
                {new Date(alert.timestamp).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {alert.entryRowIndex !== undefined && (
                <p>
                  <strong>Registro asociado:</strong> fila {alert.entryRowIndex}
                </p>
              )}
            </div>
          </div>

          {/* Edit form for inconsistency / no-show */}
          {canEdit && alert.entryRowIndex && !alert.resolved && (
            <div className="border-t pt-3">
              {!editing ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar registro de tiempo
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    Editar horario del registro
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="edit-clockin" className="text-xs">
                        Entrada
                      </Label>
                      <Input
                        id="edit-clockin"
                        type="datetime-local"
                        value={clockIn}
                        onChange={(e) => setClockIn(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-clockout" className="text-xs">
                        Salida
                      </Label>
                      <Input
                        id="edit-clockout"
                        type="datetime-local"
                        value={clockOut}
                        onChange={(e) => setClockOut(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  {error && (
                    <p className="text-xs text-red-600">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleEdit}
                      disabled={submitting || !clockIn || !clockOut}
                      className="flex-1"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Guardar y resolver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(false);
                        setError("");
                      }}
                      disabled={submitting}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approve button for overlap / inconsistency */}
          {canApprove && !alert.resolved && (
            <div className={canEdit && alert.entryRowIndex ? "" : "border-t pt-3"}>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-green-700 border-green-300 hover:bg-green-50"
                onClick={handleApprove}
              >
                <Check className="h-4 w-4 mr-2" />
                Aprobar y marcar como resuelta
              </Button>
            </div>
          )}

          {/* Generic resolve for types without specific actions */}
          {!canEdit && !canApprove && !alert.resolved && (
            <div className="border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleResolve}
              >
                <Check className="h-4 w-4 mr-2" />
                Marcar como resuelta
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
