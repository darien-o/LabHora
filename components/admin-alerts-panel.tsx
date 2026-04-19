"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/lib/admin-context";
import {
  AlertDetailPanel,
  type AdminAlertExtended,
} from "@/components/alert-detail-panel";
import {
  Bell,
  Trash2,
  UserX,
  Users,
  AlertTriangle,
  Clock,
  CalendarDays,
} from "lucide-react";

export function AdminAlertsPanel() {
  const { alerts, clearAlerts } = useAdmin();
  const [selectedAlert, setSelectedAlert] = useState<AdminAlertExtended | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const unresolvedCount = alerts.filter((a) => !a.resolved).length;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "overlap-same":
        return <UserX className="h-4 w-4 text-red-600" />;
      case "overlap-cross":
        return <Users className="h-4 w-4 text-orange-600" />;
      case "no-show":
        return <Clock className="h-4 w-4 text-purple-600" />;
      case "multi-day":
        return <CalendarDays className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case "overlap-same":
        return "border-red-200 bg-red-50";
      case "overlap-cross":
        return "border-orange-200 bg-orange-50";
      case "no-show":
        return "border-purple-200 bg-purple-50";
      case "multi-day":
        return "border-blue-200 bg-blue-50";
      default:
        return "border-yellow-200 bg-yellow-50";
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

  const handleAlertClick = (alert: AdminAlertExtended) => {
    setSelectedAlert(alert);
    setDetailOpen(true);
  };

  const handleResolved = () => {
    // Detail panel already called resolveAlert — just close
    setSelectedAlert(null);
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-base">No hay alertas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-orange-600" />
          <span className="font-semibold text-base">
            Alertas ({unresolvedCount} pendiente
            {unresolvedCount !== 1 ? "s" : ""})
          </span>
        </div>
        {alerts.some((a) => a.resolved) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAlerts}
            className="text-sm text-gray-600"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Limpiar resueltas
          </Button>
        )}
      </div>

      {alerts.map((alert) => {
        // Cast to extended type — the base alert type is compatible
        const extAlert = alert as AdminAlertExtended;
        return (
          <Card
            key={alert.id}
            className={`${alert.resolved ? "opacity-50" : "cursor-pointer hover:shadow-md transition-shadow"} ${getAlertColor(alert.type)}`}
            onClick={() => !alert.resolved && handleAlertClick(extAlert)}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className="text-xs">
                      {getAlertLabel(alert.type)}
                    </Badge>
                    <span className="text-xs text-gray-600">
                      {new Date(alert.timestamp).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {alert.resolved && (
                      <Badge className="bg-green-100 text-green-700 text-xs">
                        Resuelta
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-800">{alert.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {alert.personName}
                    {(alert as AdminAlertExtended).otherPerson
                      ? ` ↔ ${(alert as AdminAlertExtended).otherPerson}`
                      : ""}{" "}
                    · {alert.date}
                  </p>
                </div>
                {!alert.resolved && (
                  <span className="text-xs text-gray-400">Ver →</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {selectedAlert && (
        <AlertDetailPanel
          alert={selectedAlert}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
