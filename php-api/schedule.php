<?php
/**
 * GET  — Devuelve los turnos de una semana.
 *        Query: ?weekStart=YYYY-MM-DD (lunes de la semana)
 *
 * POST — Crea o elimina un turno.
 *        Body: { action: "add"|"remove"|"add-repeat", ... }
 *
 *   action "add":
 *     { date, personName, startTime, endTime }
 *     Valida contra bloqueos activos antes de crear.
 *
 *   action "add-repeat":
 *     { personName, startDate, endDate, frequency: "daily"|"weekly", startTime, endTime }
 *     Genera todas las instancias, valida contra bloqueos y solapamientos.
 *     Si hay conflictos retorna la lista de fechas conflictivas sin crear nada.
 *
 *   action "remove":
 *     { rowIndex }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if (!defined('SHEET_TURNOS')) {
    define('SHEET_TURNOS', 'Turnos');
}
if (!defined('SHEET_BLOQUEOS')) {
    define('SHEET_BLOQUEOS', 'Bloqueos');
}

try {
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handle_get($service, $sheetId);
    } else {
        handle_post($service, $sheetId);
    }
} catch (Exception $e) {
    json_error('Error en turnos: ' . $e->getMessage());
}

/**
 * Parse a date string from Google Sheets into YYYY-MM-DD.
 * Sheets may return dates as:
 *   - "4/16/2026" (M/D/YYYY — US locale)
 *   - "16/4/2026" (D/M/YYYY — ES locale)
 *   - "2026-04-16" (ISO — if RAW was used)
 *   - "04/16/2026" (MM/DD/YYYY)
 * We try multiple formats.
 */
function parse_sheet_date(string $raw): ?string {
    $raw = trim($raw);
    if (empty($raw)) return null;

    // Already ISO?
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
        return $raw;
    }

    // Try M/D/YYYY or MM/DD/YYYY (Google Sheets default for US locale)
    if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})$#', $raw, $m)) {
        $month = (int)$m[1];
        $day = (int)$m[2];
        $year = (int)$m[3];

        // Sanity: if month > 12, swap (it's D/M/YYYY)
        if ($month > 12 && $day <= 12) {
            [$month, $day] = [$day, $month];
        }

        if ($month >= 1 && $month <= 12 && $day >= 1 && $day <= 31) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
    }

    // Try parsing with DateTime as fallback
    try {
        $dt = new DateTime($raw);
        return $dt->format('Y-m-d');
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Normalize a time string from Sheets.
 * Sheets may return "12:00" or "12:00:00" or with AM/PM.
 */
function parse_sheet_time(string $raw): string {
    $raw = trim($raw);
    // Already HH:mm?
    if (preg_match('/^\d{1,2}:\d{2}$/', $raw)) {
        // Pad hour
        $parts = explode(':', $raw);
        return sprintf('%02d:%02d', (int)$parts[0], (int)$parts[1]);
    }
    // HH:mm:ss
    if (preg_match('/^(\d{1,2}):(\d{2}):\d{2}$/', $raw, $m)) {
        return sprintf('%02d:%02d', (int)$m[1], (int)$m[2]);
    }
    return $raw;
}

// ─── Block conflict checking ────────────────────────────────────────────────

/**
 * Load all blocks from the "Bloqueos" sheet.
 * Returns an array of parsed block records.
 */
function load_blocks($service, string $sheetId): array {
    $resp = $service->spreadsheets_values->get($sheetId, SHEET_BLOQUEOS . '!A:I');
    $rows = $resp->getValues() ?? [];

    $blocks = [];
    for ($i = 1; $i < count($rows); $i++) {
        $r = $rows[$i];
        if (empty($r[0]) && empty($r[1])) continue;

        $blocks[] = [
            'personName' => trim($r[0] ?? ''),
            'startDate'  => trim($r[1] ?? ''),
            'endDate'    => trim($r[2] ?? ''),
            'startTime'  => trim($r[3] ?? ''),
            'endTime'    => trim($r[4] ?? ''),
            'repeat'     => trim($r[5] ?? ''),
            'repeatEnd'  => trim($r[6] ?? ''),
            'reason'     => trim($r[7] ?? ''),
        ];
    }
    return $blocks;
}

/**
 * Check if a person has an active block on a given date/time.
 *
 * @param string $personName  Caregiver name
 * @param string $date        Shift date (YYYY-MM-DD)
 * @param string $startTime   Shift start (HH:mm)
 * @param string $endTime     Shift end (HH:mm)
 * @param array  $blocks      Loaded blocks from load_blocks()
 * @return array|null  The conflicting block info or null if no conflict
 */
function check_block_conflict(string $personName, string $date, string $startTime, string $endTime, array $blocks): ?array {
    $shiftDate = new DateTime($date);

    foreach ($blocks as $block) {
        // Only check blocks for the same person
        if (strcasecmp($block['personName'], $personName) !== 0) continue;

        $blockStartDate = $block['startDate'];
        $blockEndDate   = $block['endDate'];

        if (empty($blockStartDate) || empty($blockEndDate)) continue;

        $bStart = new DateTime($blockStartDate);
        $bEnd   = new DateTime($blockEndDate);

        // Check if the shift date falls within any instance of this block
        $dateInBlock = false;

        // Direct range check
        if ($shiftDate >= $bStart && $shiftDate <= $bEnd) {
            $dateInBlock = true;
        }

        // Weekly repetition check
        if (!$dateInBlock && $block['repeat'] === 'semanal' && !empty($block['repeatEnd'])) {
            $repeatEndDate = new DateTime($block['repeatEnd']);
            if ($shiftDate <= $repeatEndDate) {
                $blockDuration = (int)$bStart->diff($bEnd)->days;
                $instanceStart = clone $bStart;

                while ($instanceStart <= $repeatEndDate) {
                    $instanceEnd = clone $instanceStart;
                    $instanceEnd->modify("+{$blockDuration} days");

                    if ($shiftDate >= $instanceStart && $shiftDate <= $instanceEnd) {
                        $dateInBlock = true;
                        break;
                    }

                    if ($instanceStart > $shiftDate) break;

                    $instanceStart->modify('+7 days');
                }
            }
        }

        if (!$dateInBlock) continue;

        // Date matches — now check time overlap
        $blockStartTime = $block['startTime'];
        $blockEndTime   = $block['endTime'];

        // If block has no time range, it's a full-day block
        if (empty($blockStartTime) || empty($blockEndTime)) {
            return [
                'personName' => $block['personName'],
                'startDate'  => $block['startDate'],
                'endDate'    => $block['endDate'],
                'reason'     => $block['reason'],
                'fullDay'    => true,
            ];
        }

        // Check time overlap: shift overlaps block if shiftStart < blockEnd AND shiftEnd > blockStart
        if ($startTime < $blockEndTime && $endTime > $blockStartTime) {
            return [
                'personName' => $block['personName'],
                'startDate'  => $block['startDate'],
                'endDate'    => $block['endDate'],
                'startTime'  => $blockStartTime,
                'endTime'    => $blockEndTime,
                'reason'     => $block['reason'],
                'fullDay'    => false,
            ];
        }
    }

    return null;
}

/**
 * Build a human-readable error message for a block conflict.
 */
function block_conflict_message(array $conflict): string {
    $name = $conflict['personName'];
    $from = $conflict['startDate'];
    $to   = $conflict['endDate'];
    $reason = !empty($conflict['reason']) ? " Motivo: {$conflict['reason']}" : '';

    if ($conflict['fullDay']) {
        return "{$name} tiene un bloqueo de horario del {$from} al {$to}.{$reason}";
    }

    $tFrom = $conflict['startTime'];
    $tTo   = $conflict['endTime'];
    return "{$name} tiene un bloqueo de horario del {$from} al {$to} ({$tFrom}–{$tTo}).{$reason}";
}

// ─── Existing shift overlap checking ────────────────────────────────────────

/**
 * Load all existing shifts from the "Turnos" sheet.
 */
function load_existing_shifts($service, string $sheetId): array {
    $resp = $service->spreadsheets_values->get($sheetId, SHEET_TURNOS . '!A:D');
    $rows = $resp->getValues() ?? [];

    $shifts = [];
    for ($i = 1; $i < count($rows); $i++) {
        $r = $rows[$i];
        if (count($r) < 4) continue;

        $dateISO = parse_sheet_date($r[0] ?? '');
        if (!$dateISO) continue;

        $personName = trim($r[1] ?? '');
        $sTime = parse_sheet_time($r[2] ?? '');
        $eTime = parse_sheet_time($r[3] ?? '');

        if (empty($personName) || empty($sTime) || empty($eTime)) continue;

        $shifts[] = [
            'date'       => $dateISO,
            'personName' => $personName,
            'startTime'  => $sTime,
            'endTime'    => $eTime,
        ];
    }
    return $shifts;
}

/**
 * Check if a shift overlaps with any existing shift for the same person.
 *
 * @return array|null  The conflicting shift or null
 */
function check_shift_overlap(string $personName, string $date, string $startTime, string $endTime, array $existingShifts): ?array {
    foreach ($existingShifts as $shift) {
        if ($shift['date'] !== $date || $shift['personName'] !== $personName) continue;

        if ($startTime < $shift['endTime'] && $endTime > $shift['startTime']) {
            return $shift;
        }
    }
    return null;
}

// ─── Repeat instance generation ─────────────────────────────────────────────

/**
 * Generate all dates for a repeat shift configuration.
 *
 * @param string $startDate  First instance date (YYYY-MM-DD)
 * @param string $endDate    Last possible date (YYYY-MM-DD)
 * @param string $frequency  "daily" or "weekly"
 * @return string[]  Array of YYYY-MM-DD dates
 */
function generate_repeat_dates(string $startDate, string $endDate, string $frequency): array {
    $dates = [];
    $current = new DateTime($startDate);
    $end = new DateTime($endDate);
    $interval = $frequency === 'weekly' ? '+7 days' : '+1 day';

    while ($current <= $end) {
        $dates[] = $current->format('Y-m-d');
        $current->modify($interval);
    }

    return $dates;
}

// ─── Request handlers ───────────────────────────────────────────────────────

function handle_get($service, $sheetId) {
    $weekStart = $_GET['weekStart'] ?? '';
    if (!$weekStart) {
        json_error('Falta parámetro weekStart', 400);
    }

    $resp = $service->spreadsheets_values->get($sheetId, SHEET_TURNOS . '!A:D');
    $rows = $resp->getValues() ?? [];

    $startDate = new DateTime($weekStart);
    $endDate = clone $startDate;
    $endDate->modify('+6 days');

    $startISO = $startDate->format('Y-m-d');
    $endISO = $endDate->format('Y-m-d');

    $shifts = [];
    for ($i = 1; $i < count($rows); $i++) {
        $r = $rows[$i];
        if (count($r) < 4) continue;

        $dateISO = parse_sheet_date($r[0] ?? '');
        if (!$dateISO) continue;

        // Filter by week range
        if ($dateISO < $startISO || $dateISO > $endISO) continue;

        $personName = trim($r[1] ?? '');
        $startTime = parse_sheet_time($r[2] ?? '');
        $endTime = parse_sheet_time($r[3] ?? '');

        if (empty($personName) || empty($startTime) || empty($endTime)) continue;

        $shifts[] = [
            'rowIndex' => $i + 1,
            'date' => $dateISO,
            'personName' => $personName,
            'startTime' => $startTime,
            'endTime' => $endTime,
        ];
    }

    json_response($shifts);
}

function handle_post($service, $sheetId) {
    $data = get_json_body();
    $action = $data['action'] ?? '';

    if ($action === 'add') {
        handle_add($service, $sheetId, $data);
    } elseif ($action === 'add-repeat') {
        handle_add_repeat($service, $sheetId, $data);
    } elseif ($action === 'remove') {
        handle_remove($service, $sheetId, $data);
    } else {
        json_error('Acción inválida. Usa "add", "add-repeat" o "remove"', 400);
    }
}

/**
 * Handle single shift creation with block validation.
 */
function handle_add($service, $sheetId, array $data) {
    $date = $data['date'] ?? '';
    $personName = $data['personName'] ?? '';
    $startTime = $data['startTime'] ?? '';
    $endTime = $data['endTime'] ?? '';

    if (!$date || !$personName || !$startTime || !$endTime) {
        json_error('Faltan datos requeridos', 400);
    }

    // Check block conflicts
    $blocks = load_blocks($service, $sheetId);
    $blockConflict = check_block_conflict($personName, $date, $startTime, $endTime, $blocks);
    if ($blockConflict) {
        json_error(block_conflict_message($blockConflict), 400);
    }

    // Validate no overlap for same person on same day
    $existingShifts = load_existing_shifts($service, $sheetId);
    $overlap = check_shift_overlap($personName, $date, $startTime, $endTime, $existingShifts);
    if ($overlap) {
        json_error(
            "$personName ya tiene un turno de " . $overlap['startTime'] . " a " . $overlap['endTime'] . " el $date. Elimina el turno anterior primero.",
            400
        );
    }

    // Write date as YYYY-MM-DD with RAW so Sheets doesn't reformat
    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues([[$date, $personName, $startTime, $endTime]]);

    $service->spreadsheets_values->append(
        $sheetId,
        SHEET_TURNOS . '!A:D',
        $body,
        ['valueInputOption' => 'RAW', 'insertDataOption' => 'INSERT_ROWS']
    );

    json_response(['success' => true, 'message' => 'Turno agregado']);
}

/**
 * Handle repeat shift creation.
 * Generates all instances, validates each against blocks and existing shifts.
 * If any conflicts, returns the list without creating anything.
 */
function handle_add_repeat($service, $sheetId, array $data) {
    $personName = trim($data['personName'] ?? '');
    $startDate  = trim($data['startDate'] ?? '');
    $endDate    = trim($data['endDate'] ?? '');
    $frequency  = trim($data['frequency'] ?? '');
    $startTime  = trim($data['startTime'] ?? '');
    $endTime    = trim($data['endTime'] ?? '');

    if (!$personName || !$startDate || !$endDate || !$frequency || !$startTime || !$endTime) {
        json_error('Faltan datos requeridos para turno repetitivo', 400);
    }

    if ($frequency !== 'daily' && $frequency !== 'weekly') {
        json_error('Frecuencia inválida. Usa "daily" o "weekly"', 400);
    }

    if ($endDate < $startDate) {
        json_error('La fecha de fin debe ser posterior o igual a la fecha de inicio', 400);
    }

    // Generate all instance dates
    $dates = generate_repeat_dates($startDate, $endDate, $frequency);

    if (empty($dates)) {
        json_error('No se generaron instancias para el rango de fechas dado', 400);
    }

    // Load blocks and existing shifts once
    $blocks = load_blocks($service, $sheetId);
    $existingShifts = load_existing_shifts($service, $sheetId);

    // Check each instance for conflicts
    $blockConflicts = [];
    $overlapConflicts = [];

    foreach ($dates as $date) {
        $blockConflict = check_block_conflict($personName, $date, $startTime, $endTime, $blocks);
        if ($blockConflict) {
            $blockConflicts[] = [
                'date'   => $date,
                'reason' => block_conflict_message($blockConflict),
            ];
        }

        $overlap = check_shift_overlap($personName, $date, $startTime, $endTime, $existingShifts);
        if ($overlap) {
            $overlapConflicts[] = [
                'date'   => $date,
                'reason' => "$personName ya tiene un turno de {$overlap['startTime']} a {$overlap['endTime']} el $date",
            ];
        }
    }

    // If any conflicts, return them without creating anything
    if (!empty($blockConflicts) || !empty($overlapConflicts)) {
        json_response([
            'success'          => false,
            'message'          => 'Se encontraron conflictos en algunas fechas',
            'blockConflicts'   => $blockConflicts,
            'overlapConflicts' => $overlapConflicts,
            'totalInstances'   => count($dates),
            'conflictDates'    => array_values(array_unique(array_merge(
                array_column($blockConflicts, 'date'),
                array_column($overlapConflicts, 'date')
            ))),
        ], 409);
        return;
    }

    // No conflicts — create all instances
    $rows = [];
    foreach ($dates as $date) {
        $rows[] = [$date, $personName, $startTime, $endTime];
    }

    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues($rows);

    $service->spreadsheets_values->append(
        $sheetId,
        SHEET_TURNOS . '!A:D',
        $body,
        ['valueInputOption' => 'RAW', 'insertDataOption' => 'INSERT_ROWS']
    );

    json_response([
        'success'        => true,
        'message'        => 'Turnos repetitivos creados',
        'instancesCount' => count($dates),
        'dates'          => $dates,
    ]);
}

/**
 * Handle shift removal.
 */
function handle_remove($service, $sheetId, array $data) {
    $rowIndex = $data['rowIndex'] ?? 0;
    if (!$rowIndex) {
        json_error('Falta rowIndex', 400);
    }

    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues([['', '', '', '']]);

    $service->spreadsheets_values->update(
        $sheetId,
        SHEET_TURNOS . "!A$rowIndex:D$rowIndex",
        $body,
        ['valueInputOption' => 'USER_ENTERED']
    );

    json_response(['success' => true, 'message' => 'Turno eliminado']);
}
