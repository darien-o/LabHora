<?php
/**
 * POST — Cambia el estado de pago de un registro.
 * Body: { rowIndex: int, paid: bool }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

try {
    $data = get_json_body();
    $rowIndex = $data['rowIndex'] ?? 0;
    $paid = $data['paid'] ?? false;

    if (!$rowIndex) {
        json_error('Faltan datos requeridos', 400);
    }

    $service = get_sheets_service();

    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues([[$paid ? 'Sí' : 'No']]);

    $service->spreadsheets_values->update(
        GOOGLE_SHEET_ID,
        SHEET_REGISTRO . "!E$rowIndex",
        $body,
        ['valueInputOption' => 'USER_ENTERED']
    );

    json_response([
        'success' => true,
        'message' => $paid ? 'Marcado como pagado' : 'Marcado como no pagado',
    ]);
} catch (Exception $e) {
    json_error('Error al cambiar estado de pago: ' . $e->getMessage());
}
