"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, UserX, Users, ArrowRight } from "lucide-react";
import type { ConflictResult } from "@/lib/conflict-detector";
import { formatConflictMessage } from "@/lib/conflict-detector";

interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictResult[];
  personName: string;
  onAdjust: () => void; // go back and adjust times
  onForceWithAlert: () => void; // proceed and alert admin
  onCancel: () => void;
}

export function ConflictDialog({
  open,
  onOpenChange,
  conflicts,
  personName,
  onAdjust,
  onForceWithAlert,
  onCancel,
}: ConflictDialogProps) {
  const samePersonConflicts = conflicts.filter((c) => c.type === "same-person");
  const crossPersonConflicts = conflicts.filter((c) => c.type === "cross-person");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-5 w-5" />
            Cruce de Horarios Detectado
          </DialogTitle>
          <DialogDescription>
            Se encontraron cruces con registros existentes para{" "}
            <span className="font-medium">{personName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {samePersonConflicts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                <UserX className="h-4 w-4" />
                Cruce con tus propios registros
              </div>
              {samePersonConflicts.map((c, i) => (
                <Alert key={i} variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">
                    {formatConflictMessage(c)}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {crossPersonConflicts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
                <Users className="h-4 w-4" />
                Cruce con otro cuidador
              </div>
              {crossPersonConflicts.map((c, i) => (
                <Alert key={i} className="py-2 border-orange-200 bg-orange-50">
                  <AlertDescription className="text-xs text-orange-800">
                    {formatConflictMessage(c)}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
            <p className="font-medium">¿Qué deseas hacer?</p>
            <p>• Ajustar horario: vuelve a editar las horas para evitar el cruce</p>
            {crossPersonConflicts.length > 0 && (
              <p>• Continuar y alertar: guarda el registro y notifica al administrador del cruce</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="sm:order-1">
            Cancelar
          </Button>
          <Button onClick={onAdjust} className="bg-blue-600 hover:bg-blue-700 sm:order-2">
            Ajustar Horario
          </Button>
          {crossPersonConflicts.length > 0 && samePersonConflicts.length === 0 && (
            <Button
              onClick={onForceWithAlert}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50 sm:order-3"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Continuar y Alertar Admin
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
