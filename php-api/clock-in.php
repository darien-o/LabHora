<?php
/**
 * POST — Registra entrada de un cuidador.
 * Body: { personName: string, timestamp: string (ISO) }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

try {
    $data = get_json_body();
    $personName = $data['personName'] ?? '';
    $timestamp = $data['timestamp'] ?? '';
    $timezone = $data['timezone'] ?? 'America/Bogota';

    if (!$personName || !$timestamp) {
        json_error('Faltan datos requeridos', 400);
    }

    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    // Verificar que no haya alguien activo y que no exista solapamiento con registros existentes
    $resp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . '!A:E');
    $rows = $resp->getValues() ?? [];

    $clockInTime = new DateTime($timestamp);

    for ($i = count($rows) - 1; $i >= 1; $i--) {
        $r = $rows[$i];
        if (empty($r[0]) || empty($r[2])) continue;

        // Check for active (clocked-in) person
        if (empty($r[1])) {
            if ($r[2] === $personName) {
                json_error("$personName ya está fichado.", 400);
            } else {
                json_error($r[2] . ' ya está fichado. Debe registrar salida primero.', 400);
            }
        }

        // Check for overlap with completed entries of the same person
        if ($r[2] === $personName && !empty($r[1])) {
            $entryStart = parse_spanish_datetime($r[0]);
            $entryEnd = parse_spanish_datetime($r[1]);

            // If the clock-in time falls within an existing completed entry, block it
            if ($clockInTime >= $entryStart && $clockInTime < $entryEnd) {
                $startStr = $entryStart->format('d/m/Y H:i');
                $endStr = $entryEnd->format('H:i');
                json_error(
                    "$personName ya tiene un registro de $startStr a $endStr que cubre este horario. No se puede marcar entrada.",
                    400
                );
            }
        }
    }

    $formatted = format_datetime_for_sheet($timestamp, $timezone);

    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues([[$formatted, '', $personName, '', 'No']]);

    $service->spreadsheets_values->append(
        $sheetId,
        SHEET_REGISTRO . '!A:E',
        $body,
        ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
    );

    json_response([
        'success' => true,
        'message' => 'Entrada registrada correctamente',
        'data' => ['personName' => $personName, 'timestamp' => $timestamp],
    ]);
} catch (Exception $e) {
    json_error('Error al registrar entrada: ' . $e->getMessage());
}
