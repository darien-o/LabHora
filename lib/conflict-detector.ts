/**
 * Detects time range overlaps between entries.
 * Returns conflict info for UI warnings.
 */

interface EntryForConflict {
  personName: string;
  clockIn: string; // "DD/MM/YYYY, HH:mm:ss" format
  clockOut?: string;
}

export interface ConflictResult {
  type: "same-person" | "cross-person";
  existingPerson: string;
  existingStart: Date;
  existingEnd: Date;
  isActive: boolean; // entry still open (no clockOut)
}

function parseSpanishDateTime(dateTimeStr: string): Date {
  try {
    const [datePart, timePart] = dateTimeStr.split(", ");
    const [day, month, year] = datePart.split("/");
    const [hour, minute, second] = timePart.split(":");
    return new Date(
      Number.parseInt(year),
      Number.parseInt(month) - 1,
      Number.parseInt(day),
      Number.parseInt(hour),
      Number.parseInt(minute),
      Number.parseInt(second || "0")
    );
  } catch {
    return new Date();
  }
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
    const entryEnd = entry.clockOut
      ? parseSpanishDateTime(entry.clockOut)
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
  const startStr = conflict.existingStart.toLocaleDateString("es-ES", {
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
