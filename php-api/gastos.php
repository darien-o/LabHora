<?php
/**
 * Gastos extra y dinero recibido — CRUD.
 * Sheet "Gastos": A=Fecha, B=Cuidador, C=Tipo (gasto/ingreso), D=Monto,
 *                 E=Descripción, F=Registro Asociado, G=Fecha Registro
 *
 * GET  — Lista todos los gastos, con filtro opcional por registro asociado (?entryRowIndex=N)
 * POST — { action: "add"|"delete", ... }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if (!defined('SHEET_GASTOS')) {
    define('SHEET_GASTOS', 'Gastos');
}

try {
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $resp = $service->spreadsheets_values->get($sheetId, SHEET_GASTOS . '!A:G');
        $rows = $resp->getValues() ?? [];

        $entryFilter = isset($_GET['entryRowIndex']) ? trim($_GET['entryRowIndex']) : '';

        $gastos = [];
        for ($i = 1; $i < count($rows); $i++) {
            $r = $rows[$i];
            if (empty($r[0]) && empty($r[1])) continue;

            $registroAsociado = trim($r[5] ?? '');

            // Apply entryRowIndex filter if provided
            if ($entryFilter !== '' && $registroAsociado !== $entryFilter) continue;

            $gastos[] = [
                'rowIndex'         => $i + 1,
                'date'             => trim($r[0] ?? ''),
                'personName'       => trim($r[1] ?? ''),
                'type'             => trim($r[2] ?? ''),
                'amount'           => !empty($r[3]) ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '', $r[3])) : 0,
                'description'      => trim($r[4] ?? ''),
                'entryRowIndex'    => $registroAsociado !== '' ? (int)$registroAsociado : null,
                'createdAt'        => trim($r[6] ?? ''),
            ];
        }

        json_response($gastos);

    } else {
        $data = get_json_body();
        $action = $data['action'] ?? '';

        if ($action === 'add') {
            $personName     = trim($data['personName'] ?? '');
            $type           = trim($data['type'] ?? '');
            $amount         = $data['amount'] ?? 0;
            $description    = trim($data['description'] ?? '');
            $entryRowIndex  = $data['entryRowIndex'] ?? '';

            if (!$personName || !$type || !$amount) {
                json_error('Faltan datos requeridos (cuidador, tipo, monto)', 400);
            }

            if (!in_array($type, ['gasto', 'ingreso'])) {
                json_error('Tipo inválido. Debe ser "gasto" o "ingreso"', 400);
            }

            if ($amount <= 0) {
                json_error('Ingresa un monto válido mayor a cero', 400);
            }

            if ($description === '') {
                json_error('Agrega una descripción para el gasto', 400);
            }

            $now = (new DateTime('now', new DateTimeZone('America/Bogota')))->format('d/m/Y H:i');
            $date = trim($data['date'] ?? $now);

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([[$date, $personName, $type, $amount, $description, (string)$entryRowIndex, $now]]);

            $service->spreadsheets_values->append(
                $sheetId,
                SHEET_GASTOS . '!A:G',
                $body,
                ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
            );

            json_response(['success' => true, 'message' => 'Gasto registrado']);

        } elseif ($action === 'delete') {
            $rowIndex = $data['rowIndex'] ?? 0;
            if (!$rowIndex) json_error('Falta rowIndex', 400);

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([['', '', '', '', '', '', '']]);

            $service->spreadsheets_values->update(
                $sheetId,
                SHEET_GASTOS . "!A$rowIndex:G$rowIndex",
                $body,
                ['valueInputOption' => 'USER_ENTERED']
            );

            json_response(['success' => true, 'message' => 'Gasto eliminado']);

        } else {
            json_error('Acción inválida', 400);
        }
    }
} catch (Exception $e) {
    json_error('Error en gastos: ' . $e->getMessage());
}
