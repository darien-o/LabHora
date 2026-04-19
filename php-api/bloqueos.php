<?php
/**
 * Bloqueos de horario — CRUD.
 * Sheet "Bloqueos": A=Cuidador, B=Fecha Inicio, C=Fecha Fin, D=Hora Inicio,
 *                   E=Hora Fin, F=Repetir, G=Repetir Hasta, H=Motivo, I=Fecha Registro
 *
 * GET  — Lista bloqueos, con filtro opcional por semana (?weekStart=YYYY-MM-DD)
 * POST — { action: "add"|"remove", ... }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if (!defined('SHEET_BLOQUEOS')) {
    define('SHEET_BLOQUEOS', 'Bloqueos');
}

try {
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $resp = $service->spreadsheets_values->get($sheetId, SHEET_BLOQUEOS . '!A:I');
        $rows = $resp->getValues() ?? [];

        $weekStart = isset($_GET['weekStart']) ? trim($_GET['weekStart']) : '';

        // Pre-compute week boundaries when filter is active
        $weekStartDate = null;
        $weekEndDate = null;
        if ($weekStart !== '') {
            $weekStartDate = new DateTime($weekStart);
            $weekEndDate = clone $weekStartDate;
            $weekEndDate->modify('+6 days');
        }

        $bloqueos = [];
        for ($i = 1; $i < count($rows); $i++) {
            $r = $rows[$i];
            if (empty($r[0]) && empty($r[1])) continue;

            $personName = trim($r[0] ?? '');
            $startDate  = trim($r[1] ?? '');
            $endDate    = trim($r[2] ?? '');
            $startTime  = trim($r[3] ?? '');
            $endTime    = trim($r[4] ?? '');
            $repeat     = trim($r[5] ?? '');
            $repeatEnd  = trim($r[6] ?? '');
            $reason     = trim($r[7] ?? '');
            $createdAt  = trim($r[8] ?? '');

            // Apply weekStart filter if provided
            if ($weekStartDate !== null && $startDate !== '' && $endDate !== '') {
                $blockStart = new DateTime($startDate);
                $blockEnd   = new DateTime($endDate);

                // Check direct overlap: blockStart <= weekEnd AND blockEnd >= weekStart
                $directOverlap = ($blockStart <= $weekEndDate && $blockEnd >= $weekStartDate);

                // Check weekly repeating overlap
                $repeatOverlap = false;
                if (!$directOverlap && $repeat === 'semanal' && $repeatEnd !== '') {
                    $repeatEndDate = new DateTime($repeatEnd);
                    // Only consider repetitions if the repeat period reaches into or past the week
                    if ($repeatEndDate >= $weekStartDate) {
                        // Duration of the original block in days
                        $blockDuration = (int)$blockStart->diff($blockEnd)->days;

                        // Walk weekly instances from the original start
                        $instanceStart = clone $blockStart;
                        while ($instanceStart <= $repeatEndDate) {
                            $instanceEnd = clone $instanceStart;
                            $instanceEnd->modify("+{$blockDuration} days");

                            if ($instanceStart <= $weekEndDate && $instanceEnd >= $weekStartDate) {
                                $repeatOverlap = true;
                                break;
                            }

                            // If we've passed the target week, stop early
                            if ($instanceStart > $weekEndDate) {
                                break;
                            }

                            $instanceStart->modify('+7 days');
                        }
                    }
                }

                if (!$directOverlap && !$repeatOverlap) continue;
            }

            $bloqueos[] = [
                'rowIndex'      => $i + 1,
                'personName'    => $personName,
                'startDate'     => $startDate,
                'endDate'       => $endDate,
                'startTime'     => $startTime,
                'endTime'       => $endTime,
                'repeat'        => $repeat,
                'repeatEndDate' => $repeatEnd,
                'reason'        => $reason,
                'createdAt'     => $createdAt,
            ];
        }

        json_response($bloqueos);

    } else {
        $data = get_json_body();
        $action = $data['action'] ?? '';

        if ($action === 'add') {
            $personName = trim($data['personName'] ?? '');
            $startDate  = trim($data['startDate'] ?? '');
            $endDate    = trim($data['endDate'] ?? '');
            $startTime  = trim($data['startTime'] ?? '');
            $endTime    = trim($data['endTime'] ?? '');
            $repeat     = trim($data['repeat'] ?? '');
            $repeatEnd  = trim($data['repeatEndDate'] ?? '');
            $reason     = trim($data['reason'] ?? '');

            if (!$personName || !$startDate || !$endDate) {
                json_error('Faltan datos requeridos (cuidador, fecha inicio, fecha fin)', 400);
            }

            // Validate date range
            if ($endDate < $startDate) {
                json_error('La fecha de fin debe ser posterior o igual a la fecha de inicio', 400);
            }

            // Validate time range if both provided
            if ($startTime !== '' && $endTime !== '' && $endTime <= $startTime) {
                json_error('La hora de fin debe ser posterior a la hora de inicio', 400);
            }

            // Validate repeat value
            if ($repeat !== '' && $repeat !== 'semanal') {
                json_error('Valor de repetición inválido. Debe ser "semanal" o vacío', 400);
            }

            $now = (new DateTime('now', new DateTimeZone('America/Bogota')))->format('d/m/Y H:i');

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([[$personName, $startDate, $endDate, $startTime, $endTime, $repeat, $repeatEnd, $reason, $now]]);

            $service->spreadsheets_values->append(
                $sheetId,
                SHEET_BLOQUEOS . '!A:I',
                $body,
                ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
            );

            json_response(['success' => true, 'message' => 'Bloqueo agregado']);

        } elseif ($action === 'remove') {
            $rowIndex = $data['rowIndex'] ?? 0;
            if (!$rowIndex) json_error('Falta rowIndex', 400);

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([['', '', '', '', '', '', '', '', '']]);

            $service->spreadsheets_values->update(
                $sheetId,
                SHEET_BLOQUEOS . "!A$rowIndex:I$rowIndex",
                $body,
                ['valueInputOption' => 'USER_ENTERED']
            );

            json_response(['success' => true, 'message' => 'Bloqueo eliminado']);

        } else {
            json_error('Acción inválida', 400);
        }
    }
} catch (Exception $e) {
    json_error('Error en bloqueos: ' . $e->getMessage());
}
