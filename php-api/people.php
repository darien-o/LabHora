<?php
/**
 * GET — Devuelve la lista de cuidadores con estado activo y tarifa.
 * Sheet "Cuidadores": A=Nombre, B=Pago Fijo (Sí/No), C=Tarifa (COP valor hora)
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

try {
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    // 1. Obtener cuidadores con tarifa (A=Nombre, B=Pago Fijo, C=Tarifa)
    $resp = $service->spreadsheets_values->get($sheetId, SHEET_CUIDADORES . '!A:C');
    $rows = $resp->getValues() ?? [];
    $caregivers = [];
    for ($i = 0; $i < count($rows); $i++) {
        $name = trim($rows[$i][0] ?? '');
        if ($name === '' || strtolower($name) === 'nombre') continue;

        // Column B: "Pago Fijo" — Sí, Si, TRUE, true, 1 = fixed
        $fixedRaw = strtolower(trim($rows[$i][1] ?? ''));
        $isFixed = in_array($fixedRaw, ['sí', 'si', 'true', '1', 'yes', 'x']);

        // Column C: "Tarifa" — hourly rate in COP (only relevant if fixed)
        $tarifaRaw = isset($rows[$i][2]) ? trim($rows[$i][2]) : '';
        $tarifa = $tarifaRaw !== '' ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '', $tarifaRaw)) : null;

        $caregivers[] = [
            'name' => $name,
            'isFixed' => $isFixed,
            'fixedRate' => ($isFixed && $tarifa && $tarifa > 0) ? $tarifa : null,
        ];
    }

    // 2. Obtener persona activa
    $regResp = $service->spreadsheets_values->get($sheetId, SHEET_REGISTRO . '!A:E');
    $regRows = $regResp->getValues() ?? [];
    $activeName = null;
    $activeClockIn = null;

    for ($i = count($regRows) - 1; $i >= 1; $i--) {
        $r = $regRows[$i];
        if (!empty($r[0]) && !empty($r[2]) && empty($r[1])) {
            $activeName = $r[2];
            $activeClockIn = $r[0];
            break;
        }
    }

    // 3. Construir respuesta
    $people = [];
    foreach ($caregivers as $idx => $cg) {
        $isActive = $activeName === $cg['name'];
        $people[] = [
            'id' => 'person-' . $idx . '-' . preg_replace('/\s+/', '-', $cg['name']),
            'name' => $cg['name'],
            'isActive' => $isActive,
            'lastClockIn' => $isActive ? $activeClockIn : null,
            'isFixed' => $cg['isFixed'],
            'fixedRate' => $cg['fixedRate'],
            'avatar' => '/placeholder.svg?height=40&width=40&query=' . urlencode($cg['name']),
        ];
    }

    json_response($people);
} catch (Exception $e) {
    json_error('Error al obtener cuidadores: ' . $e->getMessage());
}
