<?php
/**
 * Anticipos (advance payments) CRUD.
 * Sheet "Anticipos": A=Fecha, B=Mes, C=Cuidador, D=Monto, E=Descripción,
 *                    F=Fecha Registro, G=Confirmado, H=Fecha Confirmación
 *
 * GET  — Lista todos los anticipos, con filtro opcional por mes (?month=YYYY-MM)
 * POST — { action: "add"|"edit"|"delete", ... }
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if (!defined('SHEET_ANTICIPOS')) {
    define('SHEET_ANTICIPOS', 'Anticipos');
}

try {
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $resp = $service->spreadsheets_values->get($sheetId, SHEET_ANTICIPOS . '!A:H');
        $rows = $resp->getValues() ?? [];

        $monthFilter = isset($_GET['month']) ? trim($_GET['month']) : '';

        $anticipos = [];
        for ($i = 1; $i < count($rows); $i++) {
            $r = $rows[$i];
            if (empty($r[0]) && empty($r[2])) continue;

            $month = trim($r[1] ?? '');

            // Apply month filter if provided
            if ($monthFilter !== '' && $month !== $monthFilter) continue;

            $anticipos[] = [
                'rowIndex'         => $i + 1,
                'date'             => trim($r[0] ?? ''),
                'month'            => $month,
                'personName'       => trim($r[2] ?? ''),
                'amount'           => !empty($r[3]) ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '', $r[3])) : 0,
                'description'      => trim($r[4] ?? ''),
                'createdAt'        => trim($r[5] ?? ''),
                'confirmed'        => strtolower(trim($r[6] ?? '')) === 'sí',
                'confirmationDate' => trim($r[7] ?? ''),
            ];
        }

        json_response($anticipos);

    } else {
        $data = get_json_body();
        $action = $data['action'] ?? '';

        if ($action === 'add') {
            $personName  = trim($data['personName'] ?? '');
            $amount      = $data['amount'] ?? 0;
            $date        = trim($data['date'] ?? '');
            $month       = trim($data['month'] ?? '');
            $description = trim($data['description'] ?? '');

            if (!$personName || !$amount || !$date || !$month) {
                json_error('Faltan datos requeridos (cuidador, monto, fecha, mes)', 400);
            }

            if ($amount <= 0) {
                json_error('Ingresa un monto válido mayor a cero', 400);
            }

            // Check for duplicate: same caregiver + same date
            $existing = $service->spreadsheets_values->get($sheetId, SHEET_ANTICIPOS . '!A:C');
            $existingRows = $existing->getValues() ?? [];
            for ($i = 1; $i < count($existingRows); $i++) {
                $er = $existingRows[$i];
                $existingDate = trim($er[0] ?? '');
                $existingPerson = trim($er[2] ?? '');
                if ($existingDate === $date && $existingPerson === $personName) {
                    json_error("Ya existe un anticipo para $personName en esta fecha", 400);
                }
            }

            $now = (new DateTime('now', new DateTimeZone('America/Bogota')))->format('d/m/Y H:i');

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([[$date, $month, $personName, $amount, $description, $now, '', '']]);

            $service->spreadsheets_values->append(
                $sheetId,
                SHEET_ANTICIPOS . '!A:H',
                $body,
                ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
            );

            json_response(['success' => true, 'message' => 'Anticipo agregado']);

        } elseif ($action === 'edit') {
            $rowIndex    = $data['rowIndex'] ?? 0;
            $personName  = trim($data['personName'] ?? '');
            $amount      = $data['amount'] ?? 0;
            $date        = trim($data['date'] ?? '');
            $month       = trim($data['month'] ?? '');
            $description = trim($data['description'] ?? '');

            if (!$rowIndex || !$personName || !$amount || !$date || !$month) {
                json_error('Faltan datos requeridos', 400);
            }

            if ($amount <= 0) {
                json_error('Ingresa un monto válido mayor a cero', 400);
            }

            // Keep original createdAt, confirmed, and confirmationDate
            $resp = $service->spreadsheets_values->get($sheetId, SHEET_ANTICIPOS . "!F$rowIndex:H$rowIndex");
            $existingMeta = $resp->getValues() ?? [];
            $createdAt        = !empty($existingMeta[0][0]) ? $existingMeta[0][0] : '';
            $confirmed        = !empty($existingMeta[0][1]) ? $existingMeta[0][1] : '';
            $confirmationDate = !empty($existingMeta[0][2]) ? $existingMeta[0][2] : '';

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([[$date, $month, $personName, $amount, $description, $createdAt, $confirmed, $confirmationDate]]);

            $service->spreadsheets_values->update(
                $sheetId,
                SHEET_ANTICIPOS . "!A$rowIndex:H$rowIndex",
                $body,
                ['valueInputOption' => 'USER_ENTERED']
            );

            json_response(['success' => true, 'message' => 'Anticipo actualizado']);

        } elseif ($action === 'delete') {
            $rowIndex = $data['rowIndex'] ?? 0;
            if (!$rowIndex) json_error('Falta rowIndex', 400);

            $body = new Google\Service\Sheets\ValueRange();
            $body->setValues([['', '', '', '', '', '', '', '']]);

            $service->spreadsheets_values->update(
                $sheetId,
                SHEET_ANTICIPOS . "!A$rowIndex:H$rowIndex",
                $body,
                ['valueInputOption' => 'USER_ENTERED']
            );

            json_response(['success' => true, 'message' => 'Anticipo eliminado']);

        } else {
            json_error('Acción inválida', 400);
        }
    }
} catch (Exception $e) {
    json_error('Error en anticipos: ' . $e->getMessage());
}
