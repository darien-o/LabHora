"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Timer,
  History,
  Users,
  RefreshCw,
  CalendarDays,
  Calendar,
} from "lucide-react";
import { ConfirmClockOutDialog } from "@/components/confirm-clock-out-dialog";
import { HistoricalEntryDialog } from "@/components/historical-entry-dialog";
import { BatchHistoricalDialog } from "@/components/batch-historical-dialog";
import { HistoryView } from "@/components/history-view";
import { ScheduleView } from "@/components/schedule-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchPeople,
  fetchTimeEntries,
  postClockIn,
  postClockOut,
  postHistoricalEntry,
} from "@/lib/api-client";

interface Person {
  id: string;
  name: string;
  avatar?: string;
  isActive: boolean;
  lastClockIn?: string;
  lastClockOut?: string;
}

interface TimeEntry {
  id: string;
  rowIndex: number;
  personName: string;
  clockIn: string;
  clockOut?: string;
  totalHours?: number;
  paid: boolean;
  date: string;
}

export default function ClockTracker() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showConfirmClockOut, setShowConfirmClockOut] = useState(false);
  const [showHistoricalEntry, setShowHistoricalEntry] = useState(false);
  const [showBatchHistorical, setShowBatchHistorical] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("clock");

  // Update current time every second for real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load initial data only once
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setInitialLoading(true);
    try {
      console.log("Loading initial data from sheet...");
      await Promise.all([loadPeople(), loadTimeEntries()]);
    } catch (error) {
      console.error("Error loading initial data:", error);
      showAlertMessage(
        "Error al cargar los datos iniciales. Verifica la conexión con Google Sheets."
      );
    } finally {
      setInitialLoading(false);
    }
  };

  const loadPeople = async () => {
    try {
      const data = await fetchPeople();
      if (data.error) {
        throw new Error(data.error);
      }

      setPeople(data);

      if (selectedPerson) {
        const updatedPerson = data.find(
          (person: Person) => person.name === selectedPerson.name
        );
        if (updatedPerson) {
          setSelectedPerson(updatedPerson);
        }
      }
    } catch (error: any) {
      console.error("Error loading people:", error);
      if (error.message?.includes("permission")) {
        showAlertMessage(
          "Error de permisos: Verifica que la hoja de cálculo esté compartida con la cuenta de servicio de Google."
        );
      } else {
        showAlertMessage(
          `Error al cargar la lista de personas: ${error.message}`
        );
      }
    }
  };

  const loadTimeEntries = async () => {
    try {
      const data = await fetchTimeEntries();
      if (data.error) {
        throw new Error(data.error);
      }
      setTimeEntries(data);
    } catch (error: any) {
      console.error("Error loading time entries:", error);
      showAlertMessage(
        `Error al cargar los registros de tiempo: ${error.message}`
      );
    }
  };

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPeople(), loadTimeEntries()]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getActivePerson = () => {
    return people.find((person) => person.isActive);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Helper to parse Spanish date string "DD/MM/YYYY, HH:mm:ss" to Date object
  const parseSpanishDateTime = (dateTimeStr: string): Date | null => {
    try {
      const [datePart, timePart] = dateTimeStr.split(", ");
      const [day, month, year] = datePart.split("/").map(Number);
      const [hours, minutes, seconds] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hours, minutes, seconds);
    } catch {
      return null;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateHours = (clockIn: string, clockOut: string) => {
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  };

  const showAlertMessage = (message: string) => {
    setAlertMessage(message);
    setShowAlert(true);
  };

  const handleClockIn = async () => {
    if (!selectedPerson) {
      showAlertMessage("Por favor selecciona una persona primero.");
      return;
    }

    const activePerson = getActivePerson();

    // If someone else is clocked in, show historical entry dialog
    if (activePerson && activePerson.name !== selectedPerson.name) {
      setShowHistoricalEntry(true);
      return;
    }

    // If this person is already clocked in
    if (selectedPerson.isActive) {
      showAlertMessage("Esta persona ya está fichada.");
      return;
    }

    setLoading(true);
    try {
      await postClockIn(selectedPerson.name, new Date().toISOString());
      await refreshData();
      showAlertMessage(`${selectedPerson.name} fichó entrada correctamente!`);
    } catch (error: any) {
      console.error("Error clocking in:", error);
      showAlertMessage(
        error.message || "Error al fichar entrada. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!selectedPerson) {
      showAlertMessage("Por favor selecciona una persona primero.");
      return;
    }

    if (!selectedPerson.isActive || !selectedPerson.lastClockIn) {
      showAlertMessage("Esta persona no está fichada actualmente.");
      return;
    }

    const hours = calculateHours(
      selectedPerson.lastClockIn,
      new Date().toISOString()
    );

    if (hours > 8) {
      setShowConfirmClockOut(true);
      return;
    }

    await performClockOut(new Date().toISOString());
  };

  const performClockOut = async (timestamp: string) => {
    if (!selectedPerson) return;

    setLoading(true);
    try {
      await postClockOut(selectedPerson.name, timestamp);
      await refreshData();
      showAlertMessage(`${selectedPerson.name} fichó salida correctamente!`);
    } catch (error: any) {
      console.error("Error clocking out:", error);
      showAlertMessage(
        error.message || "Error al fichar salida. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleHistoricalEntry = async (clockIn: string, clockOut: string) => {
    if (!selectedPerson) return;

    setLoading(true);
    try {
      await postHistoricalEntry(selectedPerson.name, clockIn, clockOut);
      await loadTimeEntries();
      showAlertMessage(
        `Entrada histórica agregada para ${selectedPerson.name}!`
      );
    } catch (error: any) {
      console.error("Error in historical entry:", error);
      showAlertMessage(
        error.message ||
          "Error al agregar entrada histórica. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBatchEntry = async (
    personName: string,
    clockIn: string,
    clockOut: string
  ) => {
    await postHistoricalEntry(personName, clockIn, clockOut);
  };

  const activePerson = getActivePerson();
  const canClockIn = selectedPerson && !selectedPerson.isActive;
  const canClockOut = selectedPerson && selectedPerson.isActive;

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-lg font-medium text-gray-800 mt-4">
                Cargando datos...
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Conectando con Google Sheets
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-2xl font-bold text-gray-800">
                Control de Horarios
              </CardTitle>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-mono font-bold text-blue-600">
                {formatTime(currentTime)}
              </p>
              <p className="text-sm text-gray-600">{formatDate(currentTime)}</p>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clock" className="flex items-center gap-1 text-xs">
              <Timer className="h-4 w-4" />
              Fichar
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1 text-xs">
              <CalendarDays className="h-4 w-4" />
              Turnos
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clock" className="space-y-6">
            {/* Active Status - Only show if there's actually an active person */}
            {activePerson && (
              <Card className="border-green-200 bg-green-50 shadow-md">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                      <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-green-800 text-lg">
                        {activePerson.name}
                      </p>
                      <p className="text-sm text-green-600">
                        Fichado desde las{" "}
                        {activePerson.lastClockIn
                          ? (() => {
                              const parsedDate = parseSpanishDateTime(
                                activePerson.lastClockIn
                              );
                              return parsedDate
                                ? formatTime(parsedDate)
                                : "Fecha inválida";
                            })()
                          : "Desconocido"}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      ACTIVO
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Person Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Seleccionar Cuidador
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshData}
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {people.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      No se encontraron cuidadores
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Verifica que la hoja "Cuidadores" tenga nombres en la
                      columna A
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {people.map((person) => (
                      <div
                        key={person.id}
                        className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedPerson?.id === person.id
                            ? "border-blue-500 bg-blue-50 shadow-md"
                            : person.isActive
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setSelectedPerson(person)}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <div className="relative">
                            <Avatar className="h-12 w-12">
                              <AvatarImage
                                src={person.avatar || "/placeholder.svg"}
                                alt={person.name}
                              />
                              <AvatarFallback
                                className={`${
                                  person.isActive
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-600"
                                }`}
                              >
                                {getInitials(person.name)}
                              </AvatarFallback>
                            </Avatar>
                            {person.isActive && (
                              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                            )}
                          </div>
                          <div className="text-center">
                            <p
                              className={`font-medium text-sm ${
                                person.isActive
                                  ? "text-green-800"
                                  : "text-gray-800"
                              }`}
                            >
                              {person.name}
                            </p>
                            {person.isActive && (
                              <Badge
                                variant="secondary"
                                className="text-xs mt-1 bg-green-100 text-green-700"
                              >
                                Fichado
                              </Badge>
                            )}
                          </div>
                        </div>
                        {selectedPerson?.id === person.id && (
                          <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handleClockIn}
                disabled={loading || !selectedPerson}
                className={`h-16 text-lg font-semibold transition-all ${
                  canClockIn
                    ? "bg-green-600 hover:bg-green-700 shadow-lg"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                <Timer className="h-5 w-5 mr-2" />
                Entrada
              </Button>
              <Button
                onClick={handleClockOut}
                disabled={loading || !canClockOut}
                variant="destructive"
                className={`h-16 text-lg font-semibold transition-all ${
                  canClockOut ? "shadow-lg" : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                <AlertCircle className="h-5 w-5 mr-2" />
                Salida
              </Button>
            </div>

            {/* Status Information */}
            <Card className="bg-gray-50">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    <p className="font-medium mb-2">Estado actual:</p>
                    {selectedPerson ? (
                      <div className="space-y-1">
                        <p className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              selectedPerson.isActive
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          ></span>
                          <strong>{selectedPerson.name}</strong> -{" "}
                          {selectedPerson.isActive ? "Fichado" : "No fichado"}
                        </p>
                        {activePerson &&
                          activePerson.name !== selectedPerson.name && (
                            <p className="text-orange-600 text-xs">
                              ⚠️ {activePerson.name} está actualmente fichado.
                              Puedes crear un registro histórico.
                            </p>
                          )}
                      </div>
                    ) : (
                      <p className="text-gray-500">
                        Selecciona un cuidador para continuar
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleView people={people} />
          </TabsContent>

          <TabsContent value="history">
            <div className="mb-4">
              <Button
                onClick={() => setShowBatchHistorical(true)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Agregar Días Pasados por Lote
              </Button>
            </div>
            <HistoryView
              timeEntries={timeEntries}
              people={people}
              onRefresh={loadTimeEntries}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ConfirmClockOutDialog
        open={showConfirmClockOut}
        onOpenChange={setShowConfirmClockOut}
        person={selectedPerson}
        onConfirm={performClockOut}
      />

      <HistoricalEntryDialog
        open={showHistoricalEntry}
        onOpenChange={setShowHistoricalEntry}
        person={selectedPerson}
        onConfirm={handleHistoricalEntry}
        timeEntries={timeEntries}
      />

      <BatchHistoricalDialog
        open={showBatchHistorical}
        onOpenChange={setShowBatchHistorical}
        people={people}
        timeEntries={timeEntries}
        onSubmitEntry={handleBatchEntry}
        onComplete={refreshData}
      />

      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notificación</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {alertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Aceptar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
