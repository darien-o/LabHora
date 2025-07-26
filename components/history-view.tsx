"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Clock, Calendar, User, AlertCircle } from "lucide-react"

interface TimeEntry {
  id: string
  personName: string
  clockIn: string
  clockOut?: string
  totalHours?: number
  date: string
}

interface Person {
  id: string
  name: string
}

interface HistoryViewProps {
  timeEntries: TimeEntry[]
  people: Person[]
  onRefresh: () => void
}

export function HistoryView({ timeEntries, people, onRefresh }: HistoryViewProps) {
  const [selectedPerson, setSelectedPerson] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [localPeople, setLocalPeople] = useState<Person[]>([])
  const [localEntries, setLocalEntries] = useState<TimeEntry[]>([])

  // Load fresh data when component mounts
  useEffect(() => {
    loadFreshData()
  }, [])

  // Update local state when props change
  useEffect(() => {
    setLocalPeople(people)
    setLocalEntries(timeEntries)
  }, [people, timeEntries])

  const loadFreshData = async () => {
    setLoading(true)
    try {
      // Load fresh people data
      const peopleResponse = await fetch("/api/people", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
      const peopleData = await peopleResponse.json()

      if (peopleData.error) {
        throw new Error(peopleData.error)
      }

      setLocalPeople(peopleData)

      // Load fresh time entries
      const entriesResponse = await fetch("/api/time-entries", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
      const entriesData = await entriesResponse.json()

      if (entriesData.error) {
        throw new Error(entriesData.error)
      }

      setLocalEntries(entriesData)
    } catch (error) {
      console.error("Error loading fresh data:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEntries = useMemo(() => {
    if (selectedPerson === "all") {
      return localEntries
    }
    return localEntries.filter((entry) => entry.personName === selectedPerson)
  }, [localEntries, selectedPerson])

  const totalHours = useMemo(() => {
    return filteredEntries.reduce((total, entry) => {
      return total + (entry.totalHours || 0)
    }, 0)
  }, [filteredEntries])

  const formatDateTime = (dateString: string) => {
    try {
      const date = parseSpanishDateTime(dateString)
      return {
        date: date.toLocaleDateString("es-ES"),
        time: date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      }
    } catch (error) {
      console.error("Error formatting date:", dateString, error)
      return {
        date: "Fecha inválida",
        time: "Hora inválida",
      }
    }
  }

  const formatHours = (hours: number) => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await loadFreshData()
      await onRefresh() // Also call parent refresh
    } finally {
      setLoading(false)
    }
  }

  // Helper function to parse Spanish formatted datetime
  const parseSpanishDateTime = (dateTimeStr: string): Date => {
    try {
      // Handle format: "DD/MM/YYYY, HH:mm:ss"
      const [datePart, timePart] = dateTimeStr.split(", ")
      const [day, month, year] = datePart.split("/")
      const [hour, minute, second] = timePart.split(":")

      return new Date(
        Number.parseInt(year),
        Number.parseInt(month) - 1, // Month is 0-indexed
        Number.parseInt(day),
        Number.parseInt(hour),
        Number.parseInt(minute),
        Number.parseInt(second || "0"),
      )
    } catch (error) {
      console.error("Error parsing Spanish datetime:", dateTimeStr, error)
      return new Date() // Fallback to current date
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Historial de Registros
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Filtrar por cuidador:</label>
              {localPeople.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">No se encontraron cuidadores en la hoja</span>
                </div>
              ) : (
                <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cuidador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los cuidadores</SelectItem>
                    {localPeople.map((person) => (
                      <SelectItem key={person.id} value={person.name}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Summary */}
            {selectedPerson !== "all" && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">{selectedPerson}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="font-bold text-blue-800">{formatHours(totalHours)}</span>
                  </div>
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  Total de {filteredEntries.length} registro{filteredEntries.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records List */}
      <div className="space-y-3">
        {loading && localEntries.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Cargando registros...</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay registros para mostrar</p>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedPerson === "all"
                    ? "No se encontraron registros de tiempo en la hoja"
                    : `No se encontraron registros para ${selectedPerson}`}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredEntries
            .sort((a, b) => {
              try {
                const dateA = parseSpanishDateTime(a.clockIn)
                const dateB = parseSpanishDateTime(b.clockIn)
                return dateB.getTime() - dateA.getTime()
              } catch (error) {
                return 0
              }
            })
            .map((entry) => {
              const clockInFormatted = formatDateTime(entry.clockIn)
              const clockOutFormatted = entry.clockOut ? formatDateTime(entry.clockOut) : null
              const isActive = !entry.clockOut

              return (
                <Card key={entry.id} className={isActive ? "border-green-200 bg-green-50" : ""}>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="font-medium">{entry.personName}</span>
                          {isActive && <Badge className="bg-green-100 text-green-800">Activo</Badge>}
                        </div>
                        <span className="text-sm text-gray-500">{clockInFormatted.date}</span>
                      </div>

                      {/* Times */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600 uppercase tracking-wide">Entrada</p>
                          <p className="font-mono text-sm font-medium">{clockInFormatted.time}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600 uppercase tracking-wide">Salida</p>
                          <p className="font-mono text-sm font-medium">
                            {clockOutFormatted ? clockOutFormatted.time : "En curso..."}
                          </p>
                        </div>
                      </div>

                      {/* Total hours */}
                      {entry.totalHours !== undefined && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Tiempo total:</span>
                            <span className="font-semibold text-blue-600">{formatHours(entry.totalHours)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
        )}
      </div>

      {/* Total summary for all */}
      {selectedPerson === "all" && filteredEntries.length > 0 && (
        <Card className="bg-gray-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Total general:</span>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="font-bold text-gray-800">{formatHours(totalHours)}</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {filteredEntries.length} registro{filteredEntries.length !== 1 ? "s" : ""} en total
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
