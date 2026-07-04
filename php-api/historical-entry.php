<?php
/**
 * POST — Agrega entrada histórica con verificación de conflictos.
 * Body: { personName: string, clockIn: string (ISO), clockOut: string (ISO) }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

try {
    $data = get_json_body();
    $personName = $data['personName'] ?? '';
    $clockIn = $data['clockIn'] ?? '';
    $clockOut = $data['clockOut'] ?? '';

    if (!$personName || !$clockIn || !$clockOut) {
        json_error('Faltan datos requeridos', 400);
    }

    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    // Verificar conflictos
    $resp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . '!A:E');
    $rows = $resp->getValues() ?? [];

    $newStart = new DateTime($clockIn);
    $newEnd = new DateTime($clockOut);
    $now = new DateTime('now', new DateTimeZone('America/Bogota'));

    // La hora de salida debe ser anterior a la hora actual
    if ($newEnd > $now) {
        json_error('No se puede registrar un horario que aún no ha terminado. La hora de salida debe ser anterior a la hora actual. Si necesitas programar un turno futuro, usa la opción de Programar en la pestaña de turnos.', 400);
    }

    $conflicts = [];
    for ($i = 1; $i < count($rows); $i++) {
        $r = $rows[$i];
        if (empty($r[0]) || empty($r[2])) continue;

        $entryStart = parse_spanish_datetime($r[0]);
        $entryEnd = !empty($r[1]) ? parse_spanish_datetime($r[1]) : new DateTime();

        if ($newStart < $entryEnd && $newEnd > $entryStart) {
            $startStr = $entryStart->format('d/m/Y H:i');
            $endStr = $entryEnd->format('H:i');
            $suffix = empty($r[1]) ? ' (en curso)' : '';

            // Same person overlap is a hard block
            if ($r[2] === $personName) {
                json_error(
                    "$personName ya tiene un registro desde $startStr hasta $endStr$suffix.",
                    400
                );
            }

            // Cross-person overlap: collect as warning but allow
            $conflicts[] = [
                'person' => $r[2],
                'start' => $startStr,
                'end' => $endStr,
                'active' => empty($r[1]),
            ];
        }
    }

    $clockInFormatted = format_datetime_for_sheet($clockIn);
    $clockOutFormatted = format_datetime_for_sheet($clockOut);

    $diffSeconds = $newEnd->getTimestamp() - $newStart->getTimestamp();
    $totalHours = round($diffSeconds / 3600, 2);

    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues([[$clockInFormatted, $clockOutFormatted, $personName, number_format($totalHours, 2, '.', ''), 'No']]);

    $service->spreadsheets_values->append(
        $sheetId,
        SHEET_REGISTRO . '!A:E',
        $body,
        ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
    );

    json_response([
        'success' => true,
        'message' => 'Entrada histórica agregada correctamente',
        'data' => ['personName' => $personName, 'clockIn' => $clockIn, 'clockOut' => $clockOut],
        'warnings' => $conflicts,
    ]);
} catch (Exception $e) {
    json_error('Error al agregar entrada histórica: ' . $e->getMessage());
}
