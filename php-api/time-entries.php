<?php
/**
 * GET — Devuelve todos los registros de tiempo.
 * Sheet "Registro": A=ClockIn, B=ClockOut, C=Nombre, D=Horas, E=Pagado, F=Valor Hora,
 *                   G=Notas, H=Imágenes, I=Confirmado Cuidador, J=Fecha Confirmación, K=Monto Confirmado
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

try {
    $service = get_sheets_service();
    $resp = $service->spreadsheets_values->get(GOOGLE_SHEET_ID, SHEET_REGISTRO . '!A:K');
    $rows = $resp->getValues() ?? [];

    $entries = [];
    for ($i = 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        if (empty($row[0]) || empty($row[2])) continue;

        $rowIndex = $i + 1;
        $dateTimeIn = $row[0];
        $dateTimeOut = !empty($row[1]) ? $row[1] : null;
        $personName = $row[2];
        $totalHours = !empty($row[3]) ? (float)$row[3] : null;
        $paidRaw = strtolower(trim($row[4] ?? ''));
        $paid = ($paidRaw === 'sí' || $paidRaw === 'si');
        $hourlyValue = !empty($row[5]) ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '', $row[5])) : null;

        // New columns G–K
        $notes = isset($row[6]) && $row[6] !== '' ? $row[6] : '';
        $images = isset($row[7]) && $row[7] !== '' ? $row[7] : '';
        $confirmedRaw = strtolower(trim($row[8] ?? ''));
        $confirmedByCaregiver = ($confirmedRaw === 'sí' || $confirmedRaw === 'si');
        $confirmationDate = isset($row[9]) && $row[9] !== '' ? $row[9] : null;
        $amountConfirmed = isset($row[10]) && $row[10] !== '' ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '', $row[10])) : null;

        $dateISO = '';
        try {
            $dt = parse_spanish_datetime($dateTimeIn);
            $dateISO = $dt->format('Y-m-d');
        } catch (Exception $e) {}

        $entries[] = [
            'id' => "entry-$i-$rowIndex",
            'rowIndex' => $rowIndex,
            'personName' => $personName,
            'clockIn' => $dateTimeIn,
            'clockOut' => $dateTimeOut,
            'totalHours' => $totalHours,
            'paid' => $paid,
            'hourlyValue' => $hourlyValue,
            'date' => $dateISO,
            'notes' => $notes,
            'images' => $images,
            'confirmedByCaregiver' => $confirmedByCaregiver,
            'confirmationDate' => $confirmationDate,
            'amountConfirmed' => $amountConfirmed,
        ];
    }

    json_response($entries);
} catch (Exception $e) {
    json_error('Error al obtener registros: ' . $e->getMessage());
}
