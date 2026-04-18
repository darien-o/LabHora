<?php
/**
 * Recaudos (monthly collections) CRUD.
 * Sheet "Recaudos": A=Mes (YYYY-MM), B=Monto, C=Descripción, D=Fecha Registro
 *
 * GET  — Lista todos los recaudos
 * POST — { action: "add"|"edit"|"delete", ... }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if (!defined('SHEET_RECAUDOS')) {
    define('SHEET_RECAUDOS', 'Recaudos');
}

try {
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $resp = $service->spreadsheets_values->get($sheetId, SHEET_RECAUDOS . '!A:D');
        $rows = $resp->getValues() ?? [];

        $recaudos = [];
        for ($i = 1; $i < count($rows); $i++) {
            $r = $rows[$i];
            if (empty($r[0])) continue;
            $recaudos[] = [
                'rowIndex' => $i + 1,
                'month' => trim($r[0] ?? ''),
                'amount' => !empty($r[1]) ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '', $r[1])) : 0,
                'description' => trim($r[2] ?? ''),
                'createdAt' => trim($r[3] ?? ''),
            ];
        }

        json_response($recaudos);

    } else {
        $data = get_json_body();
        $action = $data['action'] ?? '';

        if ($action === 'add') {
            $month = $data['month'] ?? '';
            $amount = $data['amount'] ?? 0;
            $description = $data['description'] ?? '';

            if (!$month || !$amount) {
                json_error('Faltan mes o monto', 400);
            }

            $now = (new DateTime('now', new DateTimeZone('America/Bogota')))->format('d/m/Y H:i');

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([[$month, $amount, $description, $now]]);

            $service->spreadsheets_values->append(
                $sheetId,
                SHEET_RECAUDOS . '!A:D',
                $body,
                ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
            );

            json_response(['success' => true, 'message' => 'Recaudo agregado']);

        } elseif ($action === 'edit') {
            $rowIndex = $data['rowIndex'] ?? 0;
            $month = $data['month'] ?? '';
            $amount = $data['amount'] ?? 0;
            $description = $data['description'] ?? '';

            if (!$rowIndex || !$month || !$amount) {
                json_error('Faltan datos requeridos', 400);
            }

            // Keep original createdAt
            $resp = $service->spreadsheets_values->get($sheetId, SHEET_RECAUDOS . "!D$rowIndex");
            $existing = $resp->getValues() ?? [];
            $createdAt = !empty($existing[0][0]) ? $existing[0][0] : '';

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([[$month, $amount, $description, $createdAt]]);

            $service->spreadsheets_values->update(
                $sheetId,
                SHEET_RECAUDOS . "!A$rowIndex:D$rowIndex",
                $body,
                ['valueInputOption' => 'USER_ENTERED']
            );

            json_response(['success' => true, 'message' => 'Recaudo actualizado']);

        } elseif ($action === 'delete') {
            $rowIndex = $data['rowIndex'] ?? 0;
            if (!$rowIndex) json_error('Falta rowIndex', 400);

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([['', '', '', '']]);

            $service->spreadsheets_values->update(
                $sheetId,
                SHEET_RECAUDOS . "!A$rowIndex:D$rowIndex",
                $body,
                ['valueInputOption' => 'USER_ENTERED']
            );

            json_response(['success' => true, 'message' => 'Recaudo eliminado']);

        } else {
            json_error('Acción inválida', 400);
        }
    }
} catch (Exception $e) {
    json_error('Error en recaudos: ' . $e->getMessage());
}
