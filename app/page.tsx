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
  Shield,
  ShieldOff,
  Bell,
  LogOut,
} from "lucide-react";
import { ConfirmClockOutDialog } from "@/components/confirm-clock-out-dialog";
import { HistoricalEntryDialog } from "@/components/historical-entry-dialog";
import { BatchHistoricalDialog } from "@/components/batch-historical-dialog";
import { HistoryView } from "@/components/history-view";
import { ScheduleView } from "@/components/schedule-view";
import { AdminLoginDialog } from "@/components/admin-login-dialog";
import { AdminAlertsPanel } from "@/components/admin-alerts-panel";
import { ProfileSelector } from "@/components/profile-selector";
import { AdminProvider, useAdmin } from "@/lib/admin-context";
import { MarujitaIcon } from "@/components/marujita-icon";
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

const PROFILE_KEY = "marujita_profile";

export default function ClockTracker() {
  return (
    <AdminProvider>
      <ClockTrackerInner />
    </AdminProvider>
  );
}

function ClockTrackerInner() {
  const { isAdmin, logout, alerts } = useAdmin();
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
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const unresolvedAlerts = alerts.filter((a) => !a.resolved).length;

  // Load saved profile from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) setProfileName(saved);
    setProfileLoaded(true);
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Auto-select person when people load and we have a saved profile
  useEffect(() => {
    if (profileName && people.length > 0 && !selectedPerson) {
      const match = people.find((p) => p.name === profileName);
      if (match) setSelectedPerson(match);
    }
  }, [profileName, people, selectedPerson]);

  const handleProfileSelect = (person: { id: string; name: string }) => {
    localStorage.setItem(PROFILE_KEY, person.name);
    setProfileName(person.name);
    // Also select this person for clock in/out
    const fullPerson = people.find((p) => p.name === person.name);
    if (fullPerson) setSelectedPerson(fullPerson);
  };

  const handleSwitchProfile = () => {
    localStorage.removeItem(PROFILE_KEY);
    setProfileName(null);
    setSelectedPerson(null);
  };

  const loadInitialData = async () => {
    setInitialLoading(true);
    try {
      await Promise.all([loadPeople(), loadTimeEntries()]);
    } catch (error) {
      console.error("Error loading initial data:", error);
      showAlertMessage("Error al cargar los datos. Verifica la conexión.");
    } finally {
      setInitialLoading(false);
    }
  };

  const loadPeople = async () => {
    try {
      const data = await fetchPeople();
      if (data.error) throw new Error(data.error);
      setPeople(data);
      setSelectedPerson((prev) => {
        if (!prev) return prev;
        const updated = data.find((p: Person) => p.name === prev.name);
        return updated || prev;
      });
    } catch (error: any) {
      console.error("Error loading people:", error);
      showAlertMessage(`Error al cargar cuidadores: ${error.message}`);
    }
  };

  const loadTimeEntries = async () => {
    try {
      const data = await fetchTimeEntries();
      if (data.error) throw new Error(data.error);
      setTimeEntries(data);
    } catch (error: any) {
      console.error("Error loading time entries:", error);
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

  const getActivePerson = () => people.find((p) => p.isActive);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase();

  const parseSpanishDateTime = (dateTimeStr: string): Date | null => {
    try {
      const [datePart, timePart] = dateTimeStr.split(", ");
      const [day, month, year] = datePart.split("/").map(Number);
      const [hours, minutes, seconds] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hours, minutes, seconds);
    } catch { return null; }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });

  const formatDate = (date: Date) =>
    date.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

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
    if (activePerson && activePerson.name !== selectedPerson.name) {
      setShowHistoricalEntry(true);
      return;
    }
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
      showAlertMessage(error.message || "Error al fichar entrada.");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!selectedPerson || !selectedPerson.isActive || !selectedPerson.lastClockIn) {
      showAlertMessage("Esta persona no está fichada actualmente.");
      return;
    }
    const start = new Date(selectedPerson.lastClockIn);
    const hours = (new Date().getTime() - start.getTime()) / (1000 * 60 * 60);
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
      showAlertMessage(error.message || "Error al fichar salida.");
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
      showAlertMessage(`Entrada histórica agregada para ${selectedPerson.name}!`);
    } catch (error: any) {
      showAlertMessage(error.message || "Error al agregar entrada histórica.");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchEntry = async (personName: string, clockIn: string, clockOut: string) => {
    await postHistoricalEntry(personName, clockIn, clockOut);
  };

  const activePerson = getActivePerson();
  const canClockIn = selectedPerson && !selectedPerson.isActive;
  const canClockOut = selectedPerson && selectedPerson.isActive;

  // Loading state
  if (initialLoading || !profileLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-5 flex items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8">
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-14 w-14 border-b-3 border-blue-600 mx-auto"></div>
              <p className="text-xl font-semibold text-gray-900 mt-5">Cargando datos...</p>
              <p className="text-base text-gray-600 mt-2">Conectando con Google Sheets</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Profile selector (Netflix-style)
  if (!profileName && people.length > 0) {
    return <ProfileSelector people={people} onSelect={handleProfileSelect} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-5">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <Card className="text-center">
          <CardHeader className="pb-5">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSwitchProfile}
                className="h-10 w-10 p-0 text-gray-400 hover:text-gray-700"
                title="Cambiar perfil"
              >
                <LogOut className="h-5 w-5" />
              </Button>
              <div className="flex items-center justify-center gap-3">
                <MarujitaIcon className="h-10 w-10" />
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Marujita Horas
                </CardTitle>
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && unresolvedAlerts > 0 && (
                  <Button variant="ghost" size="sm" className="relative h-10 w-10 p-0" onClick={() => setActiveTab("admin")}>
                    <Bell className="h-5 w-5 text-orange-600" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unresolvedAlerts}</span>
                  </Button>
                )}
                {isAdmin ? (
                  <Button variant="ghost" size="sm" onClick={logout} className="h-10 w-10 p-0 text-purple-600" title="Cerrar sesión admin">
                    <ShieldOff className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setShowAdminLogin(true)} className="h-10 w-10 p-0 text-gray-400 hover:text-purple-600" title="Acceso admin">
                    <Shield className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-center gap-1 mb-2">
                <Badge className="bg-purple-100 text-purple-700 text-sm px-3 py-1">
                  <Shield className="h-4 w-4 mr-1" />Admin
                </Badge>
              </div>
            )}
            {/* Current profile indicator */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge variant="outline" className="text-sm px-3 py-1 border-blue-300 text-blue-800 bg-blue-50">
                <Users className="h-4 w-4 mr-1" />
                {profileName}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-mono font-bold text-blue-600">{formatTime(currentTime)}</p>
              <p className="text-base text-gray-700 capitalize">{formatDate(currentTime)}</p>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full h-auto ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
            <TabsTrigger value="clock" className="flex items-center gap-1.5 text-sm py-3">
              <Timer className="h-5 w-5" />Fichar
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1.5 text-sm py-3">
              <CalendarDays className="h-5 w-5" />Turnos
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5 text-sm py-3">
              <History className="h-5 w-5" />Historial
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex items-center gap-1.5 text-sm py-3 relative">
                <Shield className="h-5 w-5" />Admin
                {unresolvedAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unresolvedAlerts}</span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="clock" className="space-y-6">
            {activePerson && (
              <Card className="border-green-200 bg-green-50 shadow-md">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                      <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-green-900 text-xl">{activePerson.name}</p>
                      <p className="text-base text-green-700">
                        Fichado desde las{" "}
                        {activePerson.lastClockIn
                          ? (() => { const d = parseSpanishDateTime(activePerson.lastClockIn); return d ? formatTime(d) : "?"; })()
                          : "?"}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300 text-sm px-3 py-1">ACTIVO</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Users className="h-6 w-6" />Seleccionar Cuidador
                  </CardTitle>
                  <Button variant="outline" onClick={refreshData} disabled={loading} className="h-11 w-11 p-0">
                    <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {people.length === 0 ? (
                  <div className="text-center py-10">
                    <AlertCircle className="h-14 w-14 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg text-gray-700">No se encontraron cuidadores</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {people.map((person) => (
                      <div
                        key={person.id}
                        className={`relative p-5 rounded-xl border-3 cursor-pointer transition-all ${
                          selectedPerson?.id === person.id
                            ? "border-blue-500 bg-blue-50 shadow-lg"
                            : person.isActive ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-gray-400"
                        }`}
                        onClick={() => setSelectedPerson(person)}
                      >
                        <div className="flex flex-col items-center space-y-3">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={person.avatar || "/placeholder.svg"} alt={person.name} />
                            <AvatarFallback className={`text-lg font-bold ${person.isActive ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-600"}`}>
                              {getInitials(person.name)}
                            </AvatarFallback>
                          </Avatar>
                          {person.isActive && <div className="absolute top-3 right-3 h-5 w-5 bg-green-500 rounded-full border-2 border-white animate-pulse" />}
                          <p className={`font-semibold text-base text-center ${person.isActive ? "text-green-900" : "text-gray-900"}`}>
                            {person.name}
                          </p>
                          {person.isActive && <Badge variant="secondary" className="text-sm bg-green-100 text-green-700 px-3">Fichado</Badge>}
                        </div>
                        {selectedPerson?.id === person.id && <CheckCircle2 className="absolute top-2 right-2 h-6 w-6 text-blue-500" />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handleClockIn}
                disabled={loading || !selectedPerson}
                className={`h-20 text-xl font-bold rounded-xl ${canClockIn ? "bg-green-600 hover:bg-green-700 shadow-lg" : "bg-gray-400 cursor-not-allowed"}`}
              >
                <Timer className="h-6 w-6 mr-2" />Entrada
              </Button>
              <Button
                onClick={handleClockOut}
                disabled={loading || !canClockOut}
                variant="destructive"
                className={`h-20 text-xl font-bold rounded-xl ${canClockOut ? "shadow-lg" : "bg-gray-400 cursor-not-allowed"}`}
              >
                <AlertCircle className="h-6 w-6 mr-2" />Salida
              </Button>
            </div>

            <Card className="bg-gray-50">
              <CardContent className="pt-5">
                <div className="text-base text-gray-700">
                  <p className="font-semibold mb-2">Estado actual:</p>
                  {selectedPerson ? (
                    <div className="space-y-2">
                      <p className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${selectedPerson.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                        <strong>{selectedPerson.name}</strong> — {selectedPerson.isActive ? "Fichado" : "No fichado"}
                      </p>
                      {activePerson && activePerson.name !== selectedPerson.name && (
                        <p className="text-orange-700 text-sm font-medium">
                          ⚠️ {activePerson.name} está actualmente fichado. Puedes crear un registro histórico.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-600">Selecciona un cuidador para continuar</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleView people={people} currentPersonName={profileName || undefined} />
          </TabsContent>

          <TabsContent value="history">
            <div className="mb-4">
              <Button onClick={() => setShowBatchHistorical(true)} className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-base font-semibold rounded-xl">
                <Calendar className="h-5 w-5 mr-2" />Agregar Días Pasados por Lote
              </Button>
            </div>
            <HistoryView timeEntries={timeEntries} people={people} onRefresh={loadTimeEntries} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <div className="space-y-5">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Shield className="h-6 w-6 text-purple-600" />Panel de Administración
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-purple-50 rounded-xl text-base text-purple-900">
                      <p className="font-semibold mb-2">Permisos activos:</p>
                      <ul className="text-sm space-y-1 text-purple-700">
                        <li>• Ver montos y liquidación laboral</li>
                        <li>• Marcar registros como pagados/no pagados</li>
                        <li>• Editar cualquier registro de tiempo</li>
                        <li>• Ver alertas de cruces de horario</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
                <AdminAlertsPanel />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <ConfirmClockOutDialog open={showConfirmClockOut} onOpenChange={setShowConfirmClockOut} person={selectedPerson} onConfirm={performClockOut} />
      <HistoricalEntryDialog open={showHistoricalEntry} onOpenChange={setShowHistoricalEntry} person={selectedPerson} onConfirm={handleHistoricalEntry} timeEntries={timeEntries} />
      <BatchHistoricalDialog open={showBatchHistorical} onOpenChange={setShowBatchHistorical} people={people} timeEntries={timeEntries} onSubmitEntry={handleBatchEntry} onComplete={refreshData} />
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Notificación</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line text-base text-gray-700">{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="h-12 text-base px-8">Aceptar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AdminLoginDialog open={showAdminLogin} onOpenChange={setShowAdminLogin} />
    </div>
  );
}
