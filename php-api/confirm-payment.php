<?php
/**
 * POST — Confirmación de pago por parte del cuidador.
 * Body: { rowIndex: int, amountReceived?: number }
 *
 * Escribe en columnas I–K de la hoja "Registro":
 *   I = Confirmado Cuidador ("Sí")
 *   J = Fecha Confirmación (DD/MM/YYYY HH:mm)
 *   K = Monto Confirmado (number, opcional)
 *
 * Requisitos: 12.4, 16.2
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido. Usa POST.', 405);
}

try {
    $data = get_json_body();
    $rowIndex = $data['rowIndex'] ?? 0;

    if (!$rowIndex || !is_numeric($rowIndex) || (int)$rowIndex < 2) {
        json_error('rowIndex es requerido y debe ser un número válido (≥ 2)', 400);
    }

    $rowIndex = (int)$rowIndex;
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    // Verificar que la fila existe y tiene datos
    $entryResp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . "!A$rowIndex:E$rowIndex");
    $entryRows = $entryResp->getValues() ?? [];
    if (empty($entryRows[0]) || empty(trim($entryRows[0][0] ?? ''))) {
        json_error('Registro no encontrado en la fila indicada', 404);
    }

    // Generar timestamp de confirmación en zona horaria de Colombia
    $now = new DateTime('now', new DateTimeZone('America/Bogota'));
    $confirmationDate = $now->format('d/m/Y H:i');

    // Preparar valores: Confirmado Cuidador, Fecha Confirmación, Monto Confirmado
    $amountReceived = isset($data['amountReceived']) && is_numeric($data['amountReceived'])
        ? (float)$data['amountReceived']
        : '';

    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues([['Sí', $confirmationDate, $amountReceived]]);

    $service->spreadsheets_values->update(
        $sheetId,
        SHEET_REGISTRO . "!I$rowIndex:K$rowIndex",
        $body,
        ['valueInputOption' => 'USER_ENTERED']
    );

    json_response([
        'success' => true,
        'message' => 'Pago confirmado por el cuidador',
        'confirmationDate' => $confirmationDate,
        'amountReceived' => $amountReceived !== '' ? $amountReceived : null,
    ]);
} catch (Exception $e) {
    json_error('Error al confirmar pago: ' . $e->getMessage());
}
