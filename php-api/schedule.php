<?php
/**
 * GET  — Devuelve los turnos de una semana.
 *        Query: ?weekStart=YYYY-MM-DD (domingo de la semana)
 *
 * POST — Crea o elimina un turno.
 *        Body: { action: "add"|"remove", date: "YYYY-MM-DD", personName, startTime: "HH:mm", endTime: "HH:mm" }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if (!defined('SHEET_TURNOS')) {
    define('SHEET_TURNOS', 'Turnos');
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
        $date = $data['date'] ?? '';
        $personName = $data['personName'] ?? '';
        $startTime = $data['startTime'] ?? '';
        $endTime = $data['endTime'] ?? '';

        if (!$date || !$personName || !$startTime || !$endTime) {
            json_error('Faltan datos requeridos', 400);
        }

        // Validate no overlap for same person on same day
        $resp = $service->spreadsheets_values->get($sheetId, SHEET_TURNOS . '!A:D');
        $rows = $resp->getValues() ?? [];

        for ($i = 1; $i < count($rows); $i++) {
            $r = $rows[$i];
            if (count($r) < 4) continue;

            $existDate = parse_sheet_date($r[0] ?? '');
            $existPerson = trim($r[1] ?? '');
            $existStart = parse_sheet_time($r[2] ?? '');
            $existEnd = parse_sheet_time($r[3] ?? '');

            if ($existDate !== $date || $existPerson !== $personName) continue;

            // Check time overlap
            if ($startTime < $existEnd && $endTime > $existStart) {
                json_error(
                    "$personName ya tiene un turno de " . $existStart . " a " . $existEnd . " el $date. Elimina el turno anterior primero.",
                    400
                );
            }
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

    } elseif ($action === 'remove') {
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

    } else {
        json_error('Acción inválida. Usa "add" o "remove"', 400);
    }
}
