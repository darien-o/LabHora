<?php
/**
 * POST — Cambia el estado de pago de un registro y calcula el valor hora.
 * Body: { rowIndex: int, paid: bool }
 *
 * Sheet "Cuidadores": A=Nombre, B=Pago Fijo (Sí/No), C=Tarifa (COP)
 * Sheet "Registro":   A=ClockIn, B=ClockOut, C=Nombre, D=Horas, E=Pagado, F=Valor Hora
 * Sheet "Recaudos":   A=Mes (YYYY-MM), B=Monto
 *
 * When marking as paid:
 * - If the person has Pago Fijo=Sí → use their Tarifa from column C
 * - If variable → calculate: (recaudo - fixed_costs) / variable_hours for that month
 * - Writes the calculated hourly value to column F
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if (!defined('SHEET_RECAUDOS')) {
    define('SHEET_RECAUDOS', 'Recaudos');
}

try {
    $data = get_json_body();
    $rowIndex = $data['rowIndex'] ?? 0;
    $paid = $data['paid'] ?? false;

    if (!$rowIndex) {
        json_error('Faltan datos requeridos', 400);
    }

    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    if (!$paid) {
        $body = new Google\Service\Sheets\ValueRange();
        $body->setValues([['No', '']]);
        $service->spreadsheets_values->update(
            $sheetId,
            SHEET_REGISTRO . "!E$rowIndex:F$rowIndex",
            $body,
            ['valueInputOption' => 'USER_ENTERED']
        );
        json_response(['success' => true, 'message' => 'Marcado como no pagado', 'hourlyValue' => null]);
        return;
    }

    // === Marking as paid — calculate hourly value ===

    // 1. Read this entry
    $entryResp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . "!A$rowIndex:F$rowIndex");
    $entryRows = $entryResp->getValues() ?? [];
    if (empty($entryRows[0])) json_error('Registro no encontrado', 404);

    $entry = $entryRows[0];
    $personName = trim($entry[2] ?? '');
    $totalHours = (float)($entry[3] ?? 0);
    $clockInRaw = $entry[0] ?? '';

    $entryMonth = '';
    try {
        $dt = parse_spanish_datetime($clockInRaw);
        $entryMonth = $dt->format('Y-m');
    } catch (Exception $e) {
        json_error('No se pudo determinar el mes del registro', 400);
    }

    // 2. Read caregivers: A=Nombre, B=Pago Fijo, C=Tarifa
    $cgResp = $service->spreadsheets_values->get($sheetId, SHEET_CUIDADORES . '!A:C');
    $cgRows = $cgResp->getValues() ?? [];
    $fixedRates = []; // name => tarifa (only for fixed-pay people)

    for ($i = 1; $i < count($cgRows); $i++) {
        $name = trim($cgRows[$i][0] ?? '');
        if (!$name) continue;

        $fixedRaw = strtolower(trim($cgRows[$i][1] ?? ''));
        $isFixed = in_array($fixedRaw, ['sí', 'si', 'true', '1', 'yes', 'x']);

        $tarifaRaw = isset($cgRows[$i][2]) ? trim($cgRows[$i][2]) : '';
        $tarifa = $tarifaRaw !== '' ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '', $tarifaRaw)) : 0;

        if ($isFixed && $tarifa > 0) {
            $fixedRates[$name] = $tarifa;
        }
    }

    // 3. If this person has a fixed rate, use it directly
    if (isset($fixedRates[$personName]) && $fixedRates[$personName] > 0) {
        $hourlyValue = $fixedRates[$personName];
    } else {
        // Variable rate: calculate from recaudo
        // 4. Get recaudo for this month
        $recResp = $service->spreadsheets_values->get($sheetId, SHEET_RECAUDOS . '!A:B');
        $recRows = $recResp->getValues() ?? [];
        $monthRecaudo = 0;
        for ($i = 1; $i < count($recRows); $i++) {
            $m = trim($recRows[$i][0] ?? '');
            if ($m === $entryMonth) {
                $monthRecaudo += (float)preg_replace('/[^0-9.]/', '', str_replace(',', '', $recRows[$i][1] ?? '0'));
            }
        }

        if ($monthRecaudo <= 0) {
            $hourlyValue = 0;
        } else {
            // 5. Read ALL entries for this month to calculate totals
            $allResp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . '!A:F');
            $allRows = $allResp->getValues() ?? [];

            $fixedCost = 0;
            $variableHours = 0;

            for ($i = 1; $i < count($allRows); $i++) {
                $r = $allRows[$i];
                if (empty($r[0]) || empty($r[1]) || empty($r[2])) continue;

                $rName = trim($r[2]);
                $rHours = (float)($r[3] ?? 0);

                try {
                    $rDt = parse_spanish_datetime($r[0]);
                    $rMonth = $rDt->format('Y-m');
                } catch (Exception $e) { continue; }

                if ($rMonth !== $entryMonth) continue;

                if (isset($fixedRates[$rName]) && $fixedRates[$rName] > 0) {
                    // Fixed-pay person: their cost = hours × their fixed rate
                    $fixedCost += $rHours * $fixedRates[$rName];
                } else {
                    // Variable-pay person: accumulate their hours
                    $variableHours += $rHours;
                }
            }

            // Remaining after paying fixed-rate people
            $remaining = $monthRecaudo - $fixedCost;
            if ($remaining < 0) $remaining = 0;

            // Divide remaining among variable hours
            $hourlyValue = $variableHours > 0 ? round($remaining / $variableHours, 0) : 0;
        }
    }

    // Write paid status + hourly value
    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues([['Sí', $hourlyValue > 0 ? number_format($hourlyValue, 0, '.', '') : '']]);

    $service->spreadsheets_values->update(
        $sheetId,
        SHEET_REGISTRO . "!E$rowIndex:F$rowIndex",
        $body,
        ['valueInputOption' => 'USER_ENTERED']
    );

    json_response([
        'success' => true,
        'message' => 'Marcado como pagado',
        'hourlyValue' => $hourlyValue,
    ]);
} catch (Exception $e) {
    json_error('Error al cambiar estado de pago: ' . $e->getMessage());
}
