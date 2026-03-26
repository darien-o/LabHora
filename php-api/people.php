<?php
/**
 * GET — Devuelve la lista de cuidadores con estado activo.
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

try {
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    // 1. Obtener cuidadores
    $resp = $service->spreadsheets_values->get($sheetId, SHEET_CUIDADORES . '!A:A');
    $rows = $resp->getValues() ?? [];
    $names = [];
    foreach ($rows as $row) {
        $name = trim($row[0] ?? '');
        if ($name !== '' && strtolower($name) !== 'nombre') {
            $names[] = $name;
        }
    }

    // 2. Obtener persona activa (último registro sin salida)
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
    foreach ($names as $idx => $name) {
        $isActive = $activeName === $name;
        $people[] = [
            'id' => 'person-' . $idx . '-' . preg_replace('/\s+/', '-', $name),
            'name' => $name,
            'isActive' => $isActive,
            'lastClockIn' => $isActive ? $activeClockIn : null,
            'avatar' => '/placeholder.svg?height=40&width=40&query=' . urlencode($name),
        ];
    }

    json_response($people);
} catch (Exception $e) {
    json_error('Error al obtener cuidadores: ' . $e->getMessage());
}
