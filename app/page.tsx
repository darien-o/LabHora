"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, CheckCircle2, AlertCircle, Timer, History, Users, RefreshCw,
  CalendarDays, Calendar, Shield, ShieldOff, Bell, LogOut,
} from "lucide-react";
import { ConfirmClockOutDialog } from "@/components/confirm-clock-out-dialog";
import { HistoricalEntryDialog } from "@/components/historical-entry-dialog";
import { BatchHistoricalDialog } from "@/components/batch-historical-dialog";
import { PostClockOutDialog } from "@/components/post-clockout-dialog";
import { HistoryView } from "@/components/history-view";
import { ScheduleView } from "@/components/schedule-view";
import { AdminLoginDialog } from "@/components/admin-login-dialog";
import { AdminAlertsPanel } from "@/components/admin-alerts-panel";
import { AdminRecaudos } from "@/components/admin-recaudos";
import { AdminLiquidation } from "@/components/admin-liquidation";
import { ProfileSelector } from "@/components/profile-selector";
import { AdminProvider, useAdmin } from "@/lib/admin-context";
import { MarujitaIcon } from "@/components/marujita-icon";
import { ActiveShiftExpenses } from "@/components/active-shift-expenses";
import { UpcomingShiftAlert } from "@/components/upcoming-shift-alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchPeople, fetchTimeEntries, postClockIn, postClockOut, postHistoricalEntry, fetchSchedule, fetchAdvances, fetchExpenses, fetchRecaudos } from "@/lib/api-client";
import { CaregiverIncomeSummary } from "@/components/caregiver-income-summary";

interface Person {
  id: string; name: string; avatar?: string; isActive: boolean;
  lastClockIn?: string; lastClockOut?: string;
  isFixed?: boolean; fixedRate?: number | null;
}
interface TimeEntry {
  id: string; rowIndex: number; personName: string; clockIn: string;
  clockOut?: string; totalHours?: number; paid: boolean; date: string;
  hourlyValue?: number; notes?: string; images?: string;
  confirmedByCaregiver?: string; confirmationDate?: string; amountConfirmed?: number;
}
interface Advance {
  rowIndex: number; personName: string; amount: number; date: string;
  month: string; description: string;
}
interface ShiftExpense {
  rowIndex: number; personName: string; entryRowIndex: number;
  type: "expense" | "income"; amount: number; description: string; date: string;
}
interface Recaudo {
  rowIndex: number; month: string; amount: number; description: string;
}

const PROFILE_KEY = "marujita_profile";
const LONG_SHIFT_HOURS = 10;
const MAX_SHIFT_HOURS = 15;
const ABNORMAL_HOURS = 16; // flag completed entries over this

export default function ClockTracker() {
  return <AdminProvider><ClockTrackerInner /></AdminProvider>;
}

function ClockTrackerInner() {
  const { isAdmin, logout, alerts, addAlert } = useAdmin();
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showConfirmClockOut, setShowConfirmClockOut] = useState(false);
  const [showHistoricalEntry, setShowHistoricalEntry] = useState(false);
  const [showBatchHistorical, setShowBatchHistorical] = useState(false);
  const [showPostClockOut, setShowPostClockOut] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("clock");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [todayShifts, setTodayShifts] = useState<Array<{ date: string; personName: string; startTime: string; endTime: string }>>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [allExpenses, setAllExpenses] = useState<ShiftExpense[]>([]);
  const [recaudos, setRecaudos] = useState<Recaudo[]>([]);

  const unresolvedAlerts = alerts.filter((a) => !a.resolved).length;

  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) setProfileName(saved);
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { loadInitialData(); }, []);

  // Auto-select person from profile
  useEffect(() => {
    if (profileName && people.length > 0 && !selectedPerson) {
      const match = people.find((p) => p.name === profileName);
      if (match) setSelectedPerson(match);
    }
  }, [profileName, people, selectedPerson]);

  // Check for >15h shifts every minute
  useEffect(() => {
    const check = () => {
      if (!selectedPerson?.isActive || !selectedPerson?.lastClockIn) return;
      const clockIn = parseSpanishDateTime(selectedPerson.lastClockIn);
      if (!clockIn) return;
      const hours = (Date.now() - clockIn.getTime()) / (1000 * 60 * 60);
      if (hours >= MAX_SHIFT_HOURS) {
        addAlert({
          type: "inconsistency",
          message: `${selectedPerson.name} lleva más de ${MAX_SHIFT_HOURS} horas fichado. Posiblemente olvidó marcar salida.`,
          personName: selectedPerson.name,
          date: new Date().toISOString().split("T")[0],
        });
        showAlertMessage(
          `⚠️ Llevas más de ${MAX_SHIFT_HOURS} horas fichado.\n\nSi olvidaste marcar la salida, por favor márcala ahora con la hora correcta.`
        );
      }
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [selectedPerson]);

  // Scan completed entries for abnormal durations (>16h)
  useEffect(() => {
    if (timeEntries.length === 0) return;
    const ALERTED_KEY = "marujita_abnormal_alerted";
    const alerted = new Set<string>(JSON.parse(localStorage.getItem(ALERTED_KEY) || "[]"));

    for (const entry of timeEntries) {
      if (!entry.clockOut || !entry.totalHours) continue;
      if (entry.totalHours <= ABNORMAL_HOURS) continue;
      if (alerted.has(entry.id)) continue;

      addAlert({
        type: "inconsistency",
        message: `Registro de ${entry.personName} con ${Math.round(entry.totalHours * 10) / 10} horas (${entry.date}). Esto parece anormal — posiblemente olvidó marcar salida.`,
        personName: entry.personName,
        date: entry.date,
      });
      alerted.add(entry.id);
    }

    localStorage.setItem(ALERTED_KEY, JSON.stringify([...alerted]));
  }, [timeEntries]);

  const handleProfileSelect = (person: { id: string; name: string }) => {
    localStorage.setItem(PROFILE_KEY, person.name);
    setProfileName(person.name);
    const full = people.find((p) => p.name === person.name);
    if (full) setSelectedPerson(full);
  };

  const handleSwitchProfile = () => {
    localStorage.removeItem(PROFILE_KEY);
    setProfileName(null);
    setSelectedPerson(null);
  };

  const loadInitialData = async () => {
    setInitialLoading(true);
    try { await Promise.all([loadPeople(), loadTimeEntries(), loadTodayShifts(), loadFinancialData()]); }
    catch { showAlertMessage("Error al cargar los datos. Verifica la conexión."); }
    finally { setInitialLoading(false); }
  };

  const loadPeople = async () => {
    try {
      const data = await fetchPeople();
      if (data.error) throw new Error(data.error);
      setPeople(data);
      setSelectedPerson((prev) => {
        if (!prev) return prev;
        return data.find((p: Person) => p.name === prev.name) || prev;
      });
    } catch (error: any) {
      showAlertMessage(`Error al cargar cuidadores: ${error.message}`);
    }
  };

  const loadTimeEntries = async () => {
    try {
      const data = await fetchTimeEntries();
      if (data.error) throw new Error(data.error);
      setTimeEntries(data);
    } catch {}
  };

  const loadTodayShifts = async () => {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      const data = await fetchSchedule(weekStart);
      if (!data.error && Array.isArray(data)) {
        setTodayShifts(data);
      }
    } catch {}
  };

  const loadFinancialData = async () => {
    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [advData, expData, recData] = await Promise.all([
        fetchAdvances(monthKey),
        fetchExpenses(),
        fetchRecaudos(),
      ]);
      if (!advData.error && Array.isArray(advData)) setAdvances(advData);
      if (!expData.error && Array.isArray(expData)) setAllExpenses(expData);
      if (!recData.error && Array.isArray(recData)) setRecaudos(recData);
    } catch {}
  };

  const refreshData = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([loadPeople(), loadTimeEntries()]); }
    finally { setLoading(false); }
  }, []);

  const getActivePerson = () => people.find((p) => p.isActive);

  const parseSpanishDateTime = (s: string): Date | null => {
    try {
      const [d, t] = s.split(", ");
      const [day, mo, yr] = d.split("/").map(Number);
      const [h, m, sec] = t.split(":").map(Number);
      return new Date(yr, mo - 1, day, h, m, sec);
    } catch { return null; }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });

  const formatDate = (d: Date) =>
    d.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const showAlertMessage = (msg: string) => { setAlertMessage(msg); setShowAlert(true); };

  const getActiveHours = (): number => {
    if (!selectedPerson?.isActive || !selectedPerson?.lastClockIn) return 0;
    const clockIn = parseSpanishDateTime(selectedPerson.lastClockIn);
    if (!clockIn) return 0;
    return (Date.now() - clockIn.getTime()) / (1000 * 60 * 60);
  };

  const handleClockIn = async () => {
    if (!selectedPerson) return;
    const active = getActivePerson();
    if (active && active.name !== selectedPerson.name) { setShowHistoricalEntry(true); return; }
    if (selectedPerson.isActive) { showAlertMessage("Ya estás fichado."); return; }
    setLoading(true);
    try {
      await postClockIn(selectedPerson.name, new Date().toISOString());
      await refreshData();
      showAlertMessage(`¡Entrada registrada! Bienvenido/a ${selectedPerson.name}.`);
    } catch (error: any) {
      showAlertMessage(error.message || "Error al registrar entrada.");
    } finally { setLoading(false); }
  };

  const handleConfirmShift = async (date: string, startTime: string) => {
    if (!selectedPerson) return;
    const active = getActivePerson();
    if (active) {
      showAlertMessage(active.name === selectedPerson.name
        ? "Ya estás fichado."
        : `${active.name} está fichado actualmente. No se puede registrar entrada automática.`);
      return;
    }
    setLoading(true);
    try {
      // Build the shift start time as the clock-in timestamp
      const [y, mo, d] = date.split("-").map(Number);
      const [h, m] = startTime.split(":").map(Number);
      const shiftStart = new Date(y, mo - 1, d, h, m, 0, 0);
      await postClockIn(selectedPerson.name, shiftStart.toISOString());
      await refreshData();
      showAlertMessage(`¡Turno confirmado! Entrada registrada para ${selectedPerson.name}.`);
    } catch (error: any) {
      showAlertMessage(error.message || "Error al confirmar turno.");
    } finally { setLoading(false); }
  };

  const handleClockOut = async () => {
    if (!selectedPerson?.isActive || !selectedPerson?.lastClockIn) return;
    const hours = getActiveHours();
    if (hours >= LONG_SHIFT_HOURS) { setShowConfirmClockOut(true); return; }
    await performClockOut(new Date().toISOString());
  };

  const performClockOut = async (timestamp: string) => {
    if (!selectedPerson) return;
    setLoading(true);
    try {
      await postClockOut(selectedPerson.name, timestamp);
      await refreshData();
      // Show post-clockout dialog for optional photos/comments
      setShowPostClockOut(true);
    } catch (error: any) {
      showAlertMessage(error.message || "Error al registrar salida.");
    } finally { setLoading(false); }
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
    } finally { setLoading(false); }
  };

  const handleBatchEntry = async (personName: string, clockIn: string, clockOut: string) => {
    await postHistoricalEntry(personName, clockIn, clockOut);
  };

  const activePerson = getActivePerson();
  const isMyProfile = selectedPerson?.name === profileName;
  const iAmActive = selectedPerson?.isActive && isMyProfile;

  // Find the active time entry's rowIndex for expenses
  const activeEntryRowIndex = useMemo(() => {
    if (!selectedPerson?.isActive) return undefined;
    const activeEntry = timeEntries.find(
      (e) => e.personName === selectedPerson.name && !e.clockOut
    );
    return activeEntry?.rowIndex;
  }, [selectedPerson, timeEntries]);

  if (initialLoading || !profileLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-5 flex items-center justify-center">
        <Card className="w-full max-w-lg"><CardContent className="pt-8">
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-14 w-14 border-b-3 border-blue-600 mx-auto" />
            <p className="text-xl font-semibold text-gray-900 mt-5">Cargando datos...</p>
          </div>
        </CardContent></Card>
      </div>
    );
  }

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
              <Button variant="ghost" size="sm" onClick={handleSwitchProfile} className="h-10 w-10 p-0 text-gray-400 hover:text-gray-700" title="Cambiar perfil">
                <LogOut className="h-5 w-5" />
              </Button>
              <div className="flex items-center justify-center gap-3">
                <MarujitaIcon className="h-10 w-10" />
                <CardTitle className="text-2xl font-bold text-gray-900">Marujita Horas</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && unresolvedAlerts > 0 && (
                  <Button variant="ghost" size="sm" className="relative h-10 w-10 p-0" onClick={() => setActiveTab("admin")}>
                    <Bell className="h-5 w-5 text-orange-600" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unresolvedAlerts}</span>
                  </Button>
                )}
                {isAdmin ? (
                  <Button variant="ghost" size="sm" onClick={logout} className="h-10 w-10 p-0 text-purple-600" title="Cerrar sesión admin"><ShieldOff className="h-5 w-5" /></Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setShowAdminLogin(true)} className="h-10 w-10 p-0 text-gray-400 hover:text-purple-600" title="Acceso admin"><Shield className="h-5 w-5" /></Button>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-center mb-2">
                <Badge className="bg-purple-100 text-purple-700 text-sm px-3 py-1"><Shield className="h-4 w-4 mr-1" />Admin</Badge>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge variant="outline" className="text-sm px-3 py-1 border-blue-300 text-blue-800 bg-blue-50">
                <Users className="h-4 w-4 mr-1" />{profileName}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-mono font-bold text-blue-600">{formatTime(currentTime)}</p>
              <p className="text-base text-gray-700 capitalize">{formatDate(currentTime)}</p>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full h-auto ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
            <TabsTrigger value="clock" className="flex items-center gap-1.5 text-sm py-3"><Timer className="h-5 w-5" />registrar</TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1.5 text-sm py-3"><CalendarDays className="h-5 w-5" />Programar</TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5 text-sm py-3"><History className="h-5 w-5" />Historial</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex items-center gap-1.5 text-sm py-3 relative">
                <Shield className="h-5 w-5" />Admin
                {unresolvedAlerts > 0 && <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unresolvedAlerts}</span>}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="clock" className="space-y-6">
            {/* Upcoming shift alert */}
            {profileName && todayShifts.length > 0 && (
              <UpcomingShiftAlert
                shifts={todayShifts}
                personName={profileName}
                onConfirmShift={handleConfirmShift}
              />
            )}

            {/* Active status banner */}
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
                        {activePerson.lastClockIn ? (() => { const d = parseSpanishDateTime(activePerson.lastClockIn); return d ? formatTime(d) : "?"; })() : "?"}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300 text-sm px-3 py-1">ACTIVO</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Simplified view for non-admin: single big button */}
            {!isAdmin && selectedPerson && (
              <div className="space-y-4">
                {iAmActive ? (
                  <>
                  <Button
                    onClick={handleClockOut}
                    disabled={loading}
                    className="w-full h-24 text-2xl font-bold rounded-2xl bg-red-600 hover:bg-red-700 shadow-lg"
                  >
                    <AlertCircle className="h-8 w-8 mr-3" />
                    Marcar Salida
                  </Button>
                  {activeEntryRowIndex !== undefined && selectedPerson && (
                    <ActiveShiftExpenses
                      personName={selectedPerson.name}
                      entryRowIndex={activeEntryRowIndex}
                    />
                  )}
                  </>
                ) : activePerson && activePerson.name !== selectedPerson.name ? (
                  <div className="space-y-3">
                    <Card className="border-orange-200 bg-orange-50">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-base text-orange-900">
                          ⚠️ <strong>{activePerson.name}</strong> está fichado actualmente.
                          Puedes registrar una entrada histórica.
                        </p>
                      </CardContent>
                    </Card>
                    <Button
                      variant="action"
                      onClick={handleClockIn}
                      disabled={loading}
                      className="w-full max-w-none h-24 text-2xl font-bold shadow-lg"
                    >
                      <Calendar className="h-8 w-8 mr-3" />
                      Crear Registro Histórico
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleClockIn}
                    disabled={loading}
                    className="w-full h-24 text-2xl font-bold rounded-2xl bg-green-600 hover:bg-green-700 shadow-lg"
                  >
                    <Timer className="h-8 w-8 mr-3" />
                    Marcar Entrada
                  </Button>
                )}

                {/* Simple status */}
                <Card className="bg-gray-50">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-base text-gray-700 flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${selectedPerson.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                      <strong>{selectedPerson.name}</strong> — {selectedPerson.isActive ? "Fichado" : "No fichado"}
                    </p>
                  </CardContent>
                </Card>

                {/* Income summary for current month */}
                {profileName && (
                  <CaregiverIncomeSummary
                    personName={profileName}
                    timeEntries={timeEntries}
                    people={people}
                    advances={advances}
                    expenses={allExpenses}
                    recaudos={recaudos}
                  />
                )}
              </div>
            )}

            {/* Admin view: full person grid + two buttons */}
            {isAdmin && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl flex items-center gap-2"><Users className="h-6 w-6" />Seleccionar Cuidador</CardTitle>
                      <Button variant="outline" onClick={refreshData} disabled={loading} className="h-11 w-11 p-0">
                        <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {people.map((person) => (
                        <div
                          key={person.id}
                          className={`relative p-5 rounded-xl border-3 cursor-pointer transition-all ${
                            selectedPerson?.id === person.id ? "border-blue-500 bg-blue-50 shadow-lg"
                            : person.isActive ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-gray-400"
                          }`}
                          onClick={() => setSelectedPerson(person)}
                        >
                          <div className="flex flex-col items-center space-y-3">
                            <Avatar className="h-16 w-16">
                              <AvatarImage src={person.avatar || "/placeholder.svg"} alt={person.name} />
                              <AvatarFallback className={`text-lg font-bold ${person.isActive ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-600"}`}>
                                {person.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {person.isActive && <div className="absolute top-3 right-3 h-5 w-5 bg-green-500 rounded-full border-2 border-white animate-pulse" />}
                            <p className={`font-semibold text-base text-center ${person.isActive ? "text-green-900" : "text-gray-900"}`}>{person.name}</p>
                            {person.isActive && <Badge variant="secondary" className="text-sm bg-green-100 text-green-700 px-3">Fichado</Badge>}
                          </div>
                          {selectedPerson?.id === person.id && <CheckCircle2 className="absolute top-2 right-2 h-6 w-6 text-blue-500" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={handleClockIn} disabled={loading || !selectedPerson}
                    className={`h-20 text-xl font-bold rounded-xl ${selectedPerson && !selectedPerson.isActive ? "bg-green-600 hover:bg-green-700 shadow-lg" : "bg-gray-400 cursor-not-allowed"}`}>
                    <Timer className="h-6 w-6 mr-2" />Entrada
                  </Button>
                  <Button onClick={handleClockOut} disabled={loading || !selectedPerson?.isActive} variant="destructive"
                    className={`h-20 text-xl font-bold rounded-xl ${selectedPerson?.isActive ? "shadow-lg" : "bg-gray-400 cursor-not-allowed"}`}>
                    <AlertCircle className="h-6 w-6 mr-2" />Salida
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleView people={people} currentPersonName={profileName || undefined} />
          </TabsContent>

          <TabsContent value="history">
            <div className="mb-4">
              <Button variant="action" onClick={() => setShowBatchHistorical(true)} className="w-full max-w-none h-14 text-base font-semibold">
                <Calendar className="h-5 w-5 mr-2" />Agregar Días Pasados por Lote
              </Button>
            </div>
            <HistoryView timeEntries={timeEntries} people={people} onRefresh={loadTimeEntries} currentPersonName={profileName || undefined} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <div className="space-y-5">
                <Card><CardHeader className="pb-4"><CardTitle className="text-xl flex items-center gap-2"><Shield className="h-6 w-6 text-purple-600" />Panel de Administración</CardTitle></CardHeader>
                  <CardContent><div className="p-4 bg-purple-50 rounded-xl text-base text-purple-900">
                    <p className="font-semibold mb-2">Permisos activos:</p>
                    <ul className="text-sm space-y-1 text-purple-700">
                      <li>• Ver montos y liquidación laboral</li>
                      <li>• Marcar registros como pagados/no pagados</li>
                      <li>• Editar cualquier registro de tiempo</li>
                      <li>• Gestionar recaudos mensuales</li>
                    </ul>
                  </div></CardContent>
                </Card>
                <AdminLiquidation />
                <AdminRecaudos />
                <AdminAlertsPanel />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <ConfirmClockOutDialog open={showConfirmClockOut} onOpenChange={setShowConfirmClockOut} person={selectedPerson} onConfirm={performClockOut} />
      <HistoricalEntryDialog open={showHistoricalEntry} onOpenChange={setShowHistoricalEntry} person={selectedPerson} onConfirm={handleHistoricalEntry} timeEntries={timeEntries} />
      <BatchHistoricalDialog open={showBatchHistorical} onOpenChange={setShowBatchHistorical} people={people} timeEntries={timeEntries} currentPersonName={profileName || undefined} onSubmitEntry={handleBatchEntry} onComplete={refreshData} />
      <PostClockOutDialog open={showPostClockOut} onOpenChange={setShowPostClockOut} personName={profileName || ""} onDone={() => showAlertMessage("¡Salida registrada correctamente!")} />
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent><AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Notificación</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line text-base text-gray-700">{alertMessage}</AlertDialogDescription>
        </AlertDialogHeader><AlertDialogFooter>
          <AlertDialogAction className="h-12 text-base px-8">Aceptar</AlertDialogAction>
        </AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AdminLoginDialog open={showAdminLogin} onOpenChange={setShowAdminLogin} />
    </div>
  );
}
