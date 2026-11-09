<?php
/**
 * POST — Registra salida de un cuidador.
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

    // Buscar último registro activo de esta persona
    $resp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . '!A:D');
    $rows = $resp->getValues() ?? [];

    $lastRowIndex = -1;
    $clockInTime = '';
    for ($i = count($rows) - 1; $i >= 1; $i--) {
        $r = $rows[$i];
        if (($r[2] ?? '') === $personName && empty($r[1])) {
            $lastRowIndex = $i;
            $clockInTime = $r[0];
            break;
        }
    }

    if ($lastRowIndex === -1) {
        json_error("No se encontró registro de entrada activo para $personName", 400);
    }

    $formatted = format_datetime_for_sheet($timestamp, $timezone);

    // Calcular horas totales
    $clockInDt = parse_spanish_datetime($clockInTime);
    $clockOutDt = new DateTime($timestamp);
    $diffSeconds = $clockOutDt->getTimestamp() - $clockInDt->getTimestamp();
    $totalHours = round($diffSeconds / 3600, 2);

    // Verificación defensiva: si el total de horas es negativo o anormalmente alto (> 72 horas),
    // verificar si el día y el mes de entrada fueron invertidos (por ejemplo, discrepancia de locale en Google Sheets)
    if ($diffSeconds < 0 || $totalHours > 72) {
        $d = (int)$clockInDt->format('d');
        $m = (int)$clockInDt->format('m');
        $y = (int)$clockInDt->format('Y');
        $timePart = $clockInDt->format('H:i:s');
        if ($d <= 12 && $m <= 12 && checkdate($d, $m, $y)) {
            $swappedDt = new DateTime(
                sprintf('%04d-%02d-%02d %s', $y, $d, $m, $timePart),
                $clockInDt->getTimezone()
            );
            $swappedDiff = $clockOutDt->getTimestamp() - $swappedDt->getTimestamp();
            $swappedHours = round($swappedDiff / 3600, 2);
            if ($swappedHours >= 0 && $swappedHours <= 72) {
                $clockInDt = $swappedDt;
                $diffSeconds = $swappedDiff;
                $totalHours = $swappedHours;
            }
        }
    }

    $rowNumber = $lastRowIndex + 1;
    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues([[$formatted, $personName, number_format($totalHours, 2, '.', '')]]);

    $service->spreadsheets_values->update(
        $sheetId,
        SHEET_REGISTRO . "!B$rowNumber:D$rowNumber",
        $body,
        ['valueInputOption' => 'USER_ENTERED']
    );

    json_response([
        'success' => true,
        'message' => 'Salida registrada correctamente',
        'data' => ['personName' => $personName, 'timestamp' => $timestamp],
    ]);
} catch (Exception $e) {
    json_error('Error al registrar salida: ' . $e->getMessage());
}
