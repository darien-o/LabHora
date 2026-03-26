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

    if (!$personName || !$timestamp) {
        json_error('Faltan datos requeridos', 400);
    }

    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    // Verificar que no haya alguien activo
    $resp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . '!A:E');
    $rows = $resp->getValues() ?? [];

    for ($i = count($rows) - 1; $i >= 1; $i--) {
        $r = $rows[$i];
        if (!empty($r[0]) && !empty($r[2]) && empty($r[1])) {
            if ($r[2] === $personName) {
                json_error("$personName ya está fichado.", 400);
            } else {
                json_error($r[2] . ' ya está fichado. Debe fichar salida primero.', 400);
            }
        }
    }

    $formatted = format_datetime_for_sheet($timestamp);

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
