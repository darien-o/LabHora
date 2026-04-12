"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/lib/admin-context";
import {
  Bell,
  Check,
  Trash2,
  UserX,
  Users,
  AlertTriangle,
} from "lucide-react";

export function AdminAlertsPanel() {
  const { alerts, resolveAlert, clearAlerts } = useAdmin();

  const unresolvedCount = alerts.filter((a) => !a.resolved).length;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "overlap-same":
        return <UserX className="h-4 w-4 text-red-600" />;
      case "overlap-cross":
        return <Users className="h-4 w-4 text-orange-600" />;
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
      default:
        return "Inconsistencia";
    }
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-6">
            <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay alertas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-orange-600" />
          <span className="font-medium text-sm">
            Alertas ({unresolvedCount} pendiente{unresolvedCount !== 1 ? "s" : ""})
          </span>
        </div>
        {alerts.some((a) => a.resolved) && (
          <Button variant="ghost" size="sm" onClick={clearAlerts} className="text-xs text-gray-500">
            <Trash2 className="h-3 w-3 mr-1" />
            Limpiar resueltas
          </Button>
        )}
      </div>

      {alerts.map((alert) => (
        <Card
          key={alert.id}
          className={`${alert.resolved ? "opacity-50" : ""} ${getAlertColor(alert.type)}`}
        >
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start gap-2">
              {getAlertIcon(alert.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">
                    {getAlertLabel(alert.type)}
                  </Badge>
                  <span className="text-[10px] text-gray-500">
                    {new Date(alert.timestamp).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {alert.resolved && (
                    <Badge className="bg-green-100 text-green-700 text-[10px]">Resuelta</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-700">{alert.message}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {alert.personName}
                  {alert.otherPerson ? ` ↔ ${alert.otherPerson}` : ""} · {alert.date}
                </p>
              </div>
              {!alert.resolved && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                  onClick={() => resolveAlert(alert.id)}
                  title="Marcar como resuelta"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
