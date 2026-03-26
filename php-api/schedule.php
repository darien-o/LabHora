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

// Ensure SHEET_TURNOS is defined (backward compat with old config.php)
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

function handle_get($service, $sheetId) {
    $weekStart = $_GET['weekStart'] ?? '';
    if (!$weekStart) {
        json_error('Falta parámetro weekStart', 400);
    }

    $resp = $service->spreadsheets_values->get($sheetId, SHEET_TURNOS . '!A:D');
    $rows = $resp->getValues() ?? [];

    // Calculate week range (Sun to Sat)
    $startDate = new DateTime($weekStart);
    $endDate = clone $startDate;
    $endDate->modify('+6 days');

    $shifts = [];
    for ($i = 1; $i < count($rows); $i++) {
        $r = $rows[$i];
        if (count($r) < 4) continue;

        $date = $r[0] ?? '';
        if ($date < $startDate->format('Y-m-d') || $date > $endDate->format('Y-m-d')) continue;

        $shifts[] = [
            'rowIndex' => $i + 1,
            'date' => $date,
            'personName' => $r[1] ?? '',
            'startTime' => $r[2] ?? '',
            'endTime' => $r[3] ?? '',
        ];
    }

    json_response($shifts);
}

function handle_post($service, $sheetId) {
    $data = get_json_body();
    $action = $data['action'] ?? '';
    $date = $data['date'] ?? '';
    $personName = $data['personName'] ?? '';
    $startTime = $data['startTime'] ?? '';
    $endTime = $data['endTime'] ?? '';

    if ($action === 'add') {
        if (!$date || !$personName || !$startTime || !$endTime) {
            json_error('Faltan datos requeridos', 400);
        }

        $body = new Google\Service\Sheets\ValueRange();
        $body->setValues([[$date, $personName, $startTime, $endTime]]);

        $service->spreadsheets_values->append(
            $sheetId,
            SHEET_TURNOS . '!A:D',
            $body,
            ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
        );

        json_response(['success' => true, 'message' => 'Turno agregado']);

    } elseif ($action === 'remove') {
        $rowIndex = $data['rowIndex'] ?? 0;
        if (!$rowIndex) {
            json_error('Falta rowIndex', 400);
        }

        // Clear the row content
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
