/**
 * Detects time range overlaps between entries.
 * Returns conflict info for UI warnings.
 */
import { parseSpanishDateTime } from "@/lib/utils";

interface EntryForConflict {
  personName: string;
  clockIn: string; // "DD/MM/YYYY, HH:mm:ss" or legacy "D/M/YYYY H:mm:ss"
  clockOut?: string;
}

export interface ConflictResult {
  type: "same-person" | "cross-person";
  existingPerson: string;
  existingStart: Date;
  existingEnd: Date;
  isActive: boolean; // entry still open (no clockOut)
}

export function detectConflicts(
  personName: string,
  newStart: Date,
  newEnd: Date,
  existingEntries: EntryForConflict[]
): ConflictResult[] {
  const conflicts: ConflictResult[] = [];

  for (const entry of existingEntries) {
    if (!entry.clockIn) continue;

    const entryStart = parseSpanishDateTime(entry.clockIn);
    if (!entryStart) continue;

    const entryEnd = entry.clockOut
      ? (parseSpanishDateTime(entry.clockOut) ?? new Date())
      : new Date();

    // Check overlap: newStart < entryEnd && newEnd > entryStart
    if (newStart < entryEnd && newEnd > entryStart) {
      conflicts.push({
        type: entry.personName === personName ? "same-person" : "cross-person",
        existingPerson: entry.personName,
        existingStart: entryStart,
        existingEnd: entryEnd,
        isActive: !entry.clockOut,
      });
    }
  }

  return conflicts;
}

export function formatConflictMessage(conflict: ConflictResult): string {
  const startStr =
    conflict.existingStart.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    }) +
    " " +
    conflict.existingStart.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const endStr = conflict.existingEnd.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const suffix = conflict.isActive ? " (en curso)" : "";

  if (conflict.type === "same-person") {
    return `Ya tienes un registro de ${startStr} a ${endStr}${suffix}. Ajusta el horario para evitar cruce.`;
  }
  return `${conflict.existingPerson} tiene un registro de ${startStr} a ${endStr}${suffix}. Ambos cubrirían el mismo horario.`;
}
