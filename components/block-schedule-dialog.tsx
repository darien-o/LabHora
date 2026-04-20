"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { postBlock } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface BlockScheduleDialogProps {
  people: Array<{ name: string }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onBlockCreated: () => void
  /** Pre-select this person. Non-admin users can only create blocks for themselves. */
  currentPersonName?: string
  isAdmin?: boolean
}

export function BlockScheduleDialog({
  people,
  open,
  onOpenChange,
  onBlockCreated,
  currentPersonName,
  isAdmin = false,
}: BlockScheduleDialogProps) {
  const { toast } = useToast()

  const [personName, setPersonName] = useState(currentPersonName || "")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [useTimeRange, setUseTimeRange] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [repeatEndDate, setRepeatEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function resetForm() {
    setPersonName(currentPersonName || "")
    setStartDate("")
    setEndDate("")
    setUseTimeRange(false)
    setStartTime("")
    setEndTime("")
    setRepeatWeekly(false)
    setRepeatEndDate("")
    setReason("")
    setError("")
  }

  function validate(): string | null {
    if (!personName) return "Selecciona un cuidador"
    if (!startDate) return "Selecciona una fecha de inicio"
    if (!endDate) return "Selecciona una fecha de fin"
    if (startDate > endDate) return "La fecha de fin debe ser posterior a la fecha de inicio"
    if (useTimeRange) {
      if (!startTime || !endTime) return "Completa el rango horario"
      if (startTime >= endTime) return "La hora de fin debe ser posterior a la hora de inicio"
    }
    if (repeatWeekly && !repeatEndDate) return "Selecciona una fecha de fin para la repetición"
    if (repeatWeekly && repeatEndDate && repeatEndDate < endDate) {
      return "La fecha de fin de repetición debe ser posterior a la fecha de fin del bloqueo"
    }
    return null
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError("")
    setSaving(true)

    try {
      await postBlock({
        action: "add",
        personName,
        startDate,
        endDate,
        startTime: useTimeRange ? startTime : undefined,
        endTime: useTimeRange ? endTime : undefined,
        repeat: repeatWeekly ? "weekly" : "",
        repeatEndDate: repeatWeekly ? repeatEndDate : undefined,
        reason: reason || undefined,
      })

      toast({
        title: "Ausencia registrada",
        description: `Ausencia para ${personName} del ${startDate} al ${endDate}`,
      })

      resetForm()
      onBlockCreated()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al crear bloqueo"
      setError(message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) resetForm()
      onOpenChange(value)
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Ausencia</DialogTitle>
          <DialogDescription>
            Registra un período de ausencia para impedir la asignación de turnos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Cuidador — admin can select anyone, regular users locked to themselves */}
          <div className="grid gap-2">
            <Label htmlFor="block-person">Cuidador</Label>
            {isAdmin ? (
              <Select value={personName} onValueChange={setPersonName}>
                <SelectTrigger id="block-person">
                  <SelectValue placeholder="Seleccionar cuidador" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 px-3 flex items-center rounded-md border bg-muted text-sm font-medium">
                {personName}
              </div>
            )}
          </div>

          {/* Fecha inicio */}
          <div className="grid gap-2">
            <Label htmlFor="block-start-date">Fecha de inicio</Label>
            <Input
              id="block-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Fecha fin */}
          <div className="grid gap-2">
            <Label htmlFor="block-end-date">Fecha de fin</Label>
            <Input
              id="block-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Rango horario opcional */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="block-use-time"
              checked={useTimeRange}
              onCheckedChange={(checked) => setUseTimeRange(checked === true)}
            />
            <Label htmlFor="block-use-time" className="cursor-pointer">
              Rango horario específico
            </Label>
          </div>

          {useTimeRange && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="block-start-time">Hora inicio</Label>
                <Input
                  id="block-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="block-end-time">Hora fin</Label>
                <Input
                  id="block-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Repetición semanal */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="block-repeat"
              checked={repeatWeekly}
              onCheckedChange={(checked) => setRepeatWeekly(checked === true)}
            />
            <Label htmlFor="block-repeat" className="cursor-pointer">
              Repetir semanalmente
            </Label>
          </div>

          {repeatWeekly && (
            <div className="grid gap-2">
              <Label htmlFor="block-repeat-end">Repetir hasta</Label>
              <Input
                id="block-repeat-end"
                type="date"
                value={repeatEndDate}
                onChange={(e) => setRepeatEndDate(e.target.value)}
              />
            </div>
          )}

          {/* Motivo */}
          <div className="grid gap-2">
            <Label htmlFor="block-reason">Motivo (opcional)</Label>
            <Input
              id="block-reason"
              placeholder="Ej: Vacaciones, cita médica..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Error inline */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "Guardando..." : "Guardar ausencia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
