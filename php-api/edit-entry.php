<?php
/**
 * POST — Edita o elimina un registro de tiempo.
 * Body:
 *   Edit:   { action: "edit", rowIndex: int, clockIn: string (ISO), clockOut: string (ISO) }
 *   Delete: { action: "delete", rowIndex: int }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

try {
    $data = get_json_body();
    $action = $data['action'] ?? '';
    $rowIndex = $data['rowIndex'] ?? 0;

    if (!$rowIndex) {
        json_error('Falta rowIndex', 400);
    }

    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    if ($action === 'edit') {
        $clockIn = $data['clockIn'] ?? '';
        $clockOut = $data['clockOut'] ?? '';

        if (!$clockIn || !$clockOut) {
            json_error('Faltan clockIn o clockOut', 400);
        }

        $clockInFormatted = format_datetime_for_sheet($clockIn);
        $clockOutFormatted = format_datetime_for_sheet($clockOut);

        $newStart = new DateTime($clockIn);
        $newEnd = new DateTime($clockOut);
        $diffSeconds = $newEnd->getTimestamp() - $newStart->getTimestamp();
        $totalHours = round($diffSeconds / 3600, 2);

        // Read current row to get personName
        $resp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . "!A$rowIndex:E$rowIndex");
        $rows = $resp->getValues() ?? [];
        if (empty($rows[0])) {
            json_error('Registro no encontrado', 404);
        }
        $personName = $rows[0][2] ?? '';
        $paidStatus = $rows[0][4] ?? 'No';

        $body = new Google\Service\Sheets\ValueRange();
        $body->setValues([[$clockInFormatted, $clockOutFormatted, $personName, number_format($totalHours, 2, '.', ''), $paidStatus]]);

        $service->spreadsheets_values->update(
            $sheetId,
            SHEET_REGISTRO . "!A$rowIndex:E$rowIndex",
            $body,
            ['valueInputOption' => 'USER_ENTERED']
        );

        json_response([
            'success' => true,
            'message' => 'Registro actualizado correctamente',
        ]);

    } elseif ($action === 'delete') {
        // Clear the row
        $body = new Google\Service\Sheets\ValueRange();
        $body->setValues([['', '', '', '', '']]);

        $service->spreadsheets_values->update(
            $sheetId,
            SHEET_REGISTRO . "!A$rowIndex:E$rowIndex",
            $body,
            ['valueInputOption' => 'USER_ENTERED']
        );

        json_response([
            'success' => true,
            'message' => 'Registro eliminado correctamente',
        ]);

    } else {
        json_error('Acción inválida. Usa "edit" o "delete"', 400);
    }
} catch (Exception $e) {
    json_error('Error al modificar registro: ' . $e->getMessage());
}
