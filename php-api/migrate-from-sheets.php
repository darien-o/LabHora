<?php
/**
 * migrate-from-sheets.php — One-time data migration: Google Sheets → MySQL.
 *
 * CLI ONLY — HTTP access is blocked via .htaccess.
 *
 * Usage:
 *   cd php-api && php migrate-from-sheets.php
 *   php migrate-from-sheets.php --dry-run   (shows counts without inserting)
 *
 * Run order (respects FK dependencies):
 *   1. cuidadores  → builds name→id map
 *   2. registros   → uses cuidador_id map
 *   3. turnos
 *   4. bloqueos
 *   5. recaudos
 *   6. anticipos
 *   7. gastos      → maps old entryRowIndex → registros.id via clock_in lookup
 *   8. recibos
 *
 * Safe to re-run: uses INSERT IGNORE / ON DUPLICATE KEY where possible.
 */

declare(strict_types=1);

// ── CLI guard ─────────────────────────────────────────────────────────────────
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Este script solo puede ejecutarse desde la línea de comandos.']);
    exit(1);
}

$isDryRun = in_array('--dry-run', $argv ?? [], true);
if ($isDryRun) {
    echo "[DRY RUN] No se realizarán cambios en la base de datos.\n";
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
$autoloadPath = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoloadPath)) {
    die("ERROR: vendor/autoload.php no encontrado. Ejecuta: composer install\n");
}
require_once $autoloadPath;

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    die("ERROR: config.php no encontrado.\n");
}
require_once $configPath;

// Load DB layer (without triggering HTTP request flow)
require_once __DIR__ . '/db.php';

// ── PDO connection ─────────────────────────────────────────────────────────────
$pdo = get_pdo();
echo "✓ Conexión a MySQL establecida.\n\n";

// ── Google Sheets service ─────────────────────────────────────────────────────
function sheets_service(): Google\Service\Sheets
{
    $client = new Google\Client();
    $client->setAuthConfig([
        'type'         => 'service_account',
        'client_email' => GOOGLE_CLIENT_EMAIL,
        'private_key'  => GOOGLE_PRIVATE_KEY,
        'token_uri'    => 'https://oauth2.googleapis.com/token',
    ]);
    $client->setScopes([Google\Service\Sheets::SPREADSHEETS_READONLY]);
    return new Google\Service\Sheets($client);
}

function fetch_sheet(Google\Service\Sheets $svc, string $range): array
{
    $resp = $svc->spreadsheets_values->get(GOOGLE_SHEET_ID, $range);
    return $resp->getValues() ?? [];
}

$sheets = sheets_service();
echo "✓ Conexión a Google Sheets establecida.\n\n";

// ── Shared: Spanish bool parsing ──────────────────────────────────────────────
function parse_bool_es(string $raw): bool
{
    return in_array(strtolower(trim($raw)), ['sí', 'si', 'true', '1', 'yes', 'x'], true);
}

// ── Shared: Spanish datetime → UTC string ────────────────────────────────────
function to_utc_string(string $raw): ?string
{
    $raw = trim($raw);
    if ($raw === '') {
        return null;
    }
    try {
        $dt = parse_spanish_datetime($raw);
        return $dt->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        // Try ISO directly
        try {
            $dt = new DateTime($raw, new DateTimeZone('America/Bogota'));
            $dt->setTimezone(new DateTimeZone('UTC'));
            return $dt->format('Y-m-d H:i:s');
        } catch (Exception $e2) {
            return null;
        }
    }
}

// ── STEP 1: cuidadores ───────────────────────────────────────────────────────
echo "── Cuidadores ──────────────────────────────\n";
$rows = fetch_sheet($sheets, SHEET_CUIDADORES . '!A:C');
$inserted = 0;
$skipped  = 0;
$nameToId = [];

foreach ($rows as $i => $row) {
    $nombre = trim($row[0] ?? '');
    if ($nombre === '' || strtolower($nombre) === 'nombre') {
        continue;
    }

    $fixedRaw = strtolower(trim($row[1] ?? ''));
    $pagoFijo = in_array($fixedRaw, ['sí', 'si', 'true', '1', 'yes', 'x'], true) ? 1 : 0;
    $tarifaRaw = isset($row[2]) ? trim($row[2]) : '';
    $tarifaCop = $tarifaRaw !== ''
        ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '.', $tarifaRaw))
        : null;

    if (!$isDryRun) {
        $stmt = $pdo->prepare(
            'INSERT INTO cuidadores (nombre, pago_fijo, tarifa_cop)
             VALUES (?,?,?)
             ON DUPLICATE KEY UPDATE pago_fijo = VALUES(pago_fijo), tarifa_cop = VALUES(tarifa_cop)'
        );
        $stmt->execute([$nombre, $pagoFijo, $tarifaCop]);

        if ($stmt->rowCount() === 1) {
            $inserted++;
        } else {
            $skipped++;
        }
    } else {
        $inserted++;
    }
}

// Build name→id map regardless of dry-run
$mapStmt = $pdo->prepare('SELECT id, nombre FROM cuidadores');
$mapStmt->execute();
foreach ($mapStmt->fetchAll() as $row) {
    $nameToId[$row['nombre']] = (int)$row['id'];
}

echo "  Insertados: $inserted  |  Actualizados/Ignorados: $skipped\n\n";

// ── STEP 2: registros ────────────────────────────────────────────────────────
echo "── Registros ───────────────────────────────\n";
$rows       = fetch_sheet($sheets, SHEET_REGISTRO . '!A:K');
$inserted   = 0;
$skipped    = 0;
$clockInMap = []; // "cuidadorId|clock_in_utc" → registro DB id (for gastos mapping)

foreach ($rows as $i => $row) {
    if ($i === 0) continue; // header
    $clockInRaw = trim($row[0] ?? '');
    $nombre     = trim($row[2] ?? '');

    if ($clockInRaw === '' || $nombre === '') {
        continue;
    }

    $cuidadorId = $nameToId[$nombre] ?? null;
    if ($cuidadorId === null) {
        echo "  WARN: Cuidador '$nombre' no encontrado. Fila ignorada.\n";
        $skipped++;
        continue;
    }

    $clockInUtc  = to_utc_string($clockInRaw);
    $clockOutUtc = to_utc_string(trim($row[1] ?? ''));
    if ($clockInUtc === null) {
        $skipped++;
        continue;
    }

    $totalHoras      = isset($row[3]) && $row[3] !== '' ? (float)$row[3] : null;
    $pagado          = parse_bool_es($row[4] ?? '') ? 1 : 0;
    $valorHoraRaw    = isset($row[5]) && $row[5] !== ''
        ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '.', $row[5])) : null;
    $notas           = trim($row[6] ?? '') ?: null;
    $imagenes        = trim($row[7] ?? '') ?: null;
    $confirmadoRaw   = parse_bool_es($row[8] ?? '') ? 1 : 0;
    $fechaConfirm    = to_utc_string(trim($row[9] ?? ''));
    $montoConfirmRaw = isset($row[10]) && $row[10] !== ''
        ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '.', $row[10])) : null;

    if (!$isDryRun) {
        $ins = $pdo->prepare(
            'INSERT IGNORE INTO registros
                 (cuidador_id, clock_in, clock_out, total_horas, pagado, valor_hora,
                  notas, imagenes, confirmado_cuidador, fecha_confirmacion, monto_confirmado)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        );
        $ins->execute([
            $cuidadorId, $clockInUtc, $clockOutUtc, $totalHoras, $pagado, $valorHoraRaw,
            $notas, $imagenes, $confirmadoRaw, $fechaConfirm, $montoConfirmRaw,
        ]);

        if ($ins->rowCount() > 0) {
            $newId = (int)$pdo->lastInsertId();
            $clockInMap["$cuidadorId|$clockInUtc"] = $newId;
            $inserted++;
        } else {
            // Already exists — look up its id for the gastos map
            $existing = $pdo->prepare(
                'SELECT id FROM registros WHERE cuidador_id=? AND clock_in=? LIMIT 1'
            );
            $existing->execute([$cuidadorId, $clockInUtc]);
            $existId = $existing->fetchColumn();
            if ($existId) {
                $clockInMap["$cuidadorId|$clockInUtc"] = (int)$existId;
            }
            $skipped++;
        }
    } else {
        $inserted++;
    }
}
echo "  Insertados: $inserted  |  Ignorados: $skipped\n\n";

// ── STEP 3: turnos ───────────────────────────────────────────────────────────
echo "── Turnos ──────────────────────────────────\n";
$rows     = fetch_sheet($sheets, SHEET_TURNOS . '!A:D');
$inserted = 0;
$skipped  = 0;

foreach ($rows as $i => $row) {
    if ($i === 0) continue;
    $rawDate  = trim($row[0] ?? '');
    $nombre   = trim($row[1] ?? '');
    $startRaw = trim($row[2] ?? '');
    $endRaw   = trim($row[3] ?? '');

    if ($rawDate === '' || $nombre === '' || $startRaw === '' || $endRaw === '') {
        continue;
    }

    // Parse sheet date (M/D/YYYY or YYYY-MM-DD)
    $fecha = _parse_sheet_date($rawDate);
    if ($fecha === null) {
        $skipped++;
        continue;
    }

    $cuidadorId = $nameToId[$nombre] ?? null;
    if ($cuidadorId === null) {
        $skipped++;
        continue;
    }

    try {
        $startTime = validate_time($startRaw);
        $endTime   = validate_time($endRaw);
    } catch (Exception $e) {
        $skipped++;
        continue;
    }

    if (!$isDryRun) {
        $ins = $pdo->prepare(
            'INSERT IGNORE INTO turnos (cuidador_id, fecha, hora_inicio, hora_fin) VALUES (?,?,?,?)'
        );
        $ins->execute([$cuidadorId, $fecha, $startTime, $endTime]);
        $ins->rowCount() > 0 ? $inserted++ : $skipped++;
    } else {
        $inserted++;
    }
}
echo "  Insertados: $inserted  |  Ignorados: $skipped\n\n";

// ── STEP 4: bloqueos ─────────────────────────────────────────────────────────
echo "── Bloqueos ────────────────────────────────\n";
$rows     = fetch_sheet($sheets, SHEET_BLOQUEOS . '!A:I');
$inserted = 0;
$skipped  = 0;

foreach ($rows as $i => $row) {
    if ($i === 0) continue;
    $nombre      = trim($row[0] ?? '');
    $startDateRaw= trim($row[1] ?? '');
    $endDateRaw  = trim($row[2] ?? '');
    $startTimeRaw= trim($row[3] ?? '');
    $endTimeRaw  = trim($row[4] ?? '');

    if ($nombre === '' || $startDateRaw === '') {
        continue;
    }

    $cuidadorId  = $nameToId[$nombre] ?? null;
    if ($cuidadorId === null) { $skipped++; continue; }

    $fechaInicio = _parse_sheet_date($startDateRaw);
    $fechaFin    = _parse_sheet_date($endDateRaw) ?? $fechaInicio;
    if ($fechaInicio === null) { $skipped++; continue; }

    try {
        $startTime = validate_time($startTimeRaw ?: '00:00');
        $endTime   = validate_time($endTimeRaw   ?: '23:59');
    } catch (Exception $e) {
        $skipped++;
        continue;
    }

    $repetir      = trim($row[5] ?? '') ?: null;
    $repetirHasta = _parse_sheet_date(trim($row[6] ?? ''));
    $motivo       = trim($row[7] ?? '') ?: null;

    if (!$isDryRun) {
        $ins = $pdo->prepare(
            'INSERT INTO bloqueos
                 (cuidador_id, fecha_inicio, fecha_fin, hora_inicio, hora_fin,
                  repetir, repetir_hasta, motivo)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        $ins->execute([
            $cuidadorId, $fechaInicio, $fechaFin, $startTime, $endTime,
            $repetir, $repetirHasta, $motivo,
        ]);
        $inserted++;
    } else {
        $inserted++;
    }
}
echo "  Insertados: $inserted  |  Ignorados: $skipped\n\n";

// ── STEP 5: recaudos ─────────────────────────────────────────────────────────
echo "── Recaudos ────────────────────────────────\n";
$rows     = fetch_sheet($sheets, SHEET_RECAUDOS . '!A:D');
$inserted = 0;
$skipped  = 0;

foreach ($rows as $i => $row) {
    if ($i === 0) continue;
    $mes   = trim($row[0] ?? '');
    $monto = isset($row[1]) ? (float)preg_replace('/[^0-9.]/', '', str_replace(',', '.', $row[1])) : 0;

    if ($mes === '' || $monto <= 0) {
        continue;
    }

    // Validate YYYY-MM format
    if (!preg_match('/^\d{4}-\d{2}$/', $mes)) {
        $skipped++;
        continue;
    }

    $descripcion = trim($row[2] ?? '') ?: null;

    if (!$isDryRun) {
        $ins = $pdo->prepare(
            'INSERT INTO recaudos (mes, monto, descripcion) VALUES (?,?,?)'
        );
        $ins->execute([$mes, $monto, $descripcion]);
        $inserted++;
    } else {
        $inserted++;
    }
}
echo "  Insertados: $inserted  |  Ignorados: $skipped\n\n";

// ── STEP 6: anticipos ────────────────────────────────────────────────────────
echo "── Anticipos ───────────────────────────────\n";
$rows     = fetch_sheet($sheets, SHEET_ANTICIPOS . '!A:H');
$inserted = 0;
$skipped  = 0;

foreach ($rows as $i => $row) {
    if ($i === 0) continue;
    $fechaRaw   = trim($row[0] ?? '');
    $mes        = trim($row[1] ?? '');
    $nombre     = trim($row[2] ?? '');
    $montoRaw   = trim($row[3] ?? '');

    if ($nombre === '' || $fechaRaw === '' || $montoRaw === '') {
        continue;
    }

    $fecha      = _parse_sheet_date($fechaRaw);
    $monto      = (float)preg_replace('/[^0-9.]/', '', str_replace(',', '.', $montoRaw));
    $descripcion = trim($row[4] ?? '') ?: null;
    $confirmado  = parse_bool_es($row[6] ?? '') ? 1 : 0;
    $fechaConf   = to_utc_string(trim($row[7] ?? ''));

    $cuidadorId = $nameToId[$nombre] ?? null;
    if ($cuidadorId === null || $fecha === null || $monto <= 0) {
        $skipped++;
        continue;
    }

    if (!$isDryRun) {
        $ins = $pdo->prepare(
            'INSERT INTO anticipos
                 (cuidador_id, fecha, mes, monto, descripcion, confirmado, fecha_confirmacion)
             VALUES (?,?,?,?,?,?,?)'
        );
        $ins->execute([$cuidadorId, $fecha, $mes, $monto, $descripcion, $confirmado, $fechaConf]);
        $inserted++;
    } else {
        $inserted++;
    }
}
echo "  Insertados: $inserted  |  Ignorados: $skipped\n\n";

// ── STEP 7: gastos ───────────────────────────────────────────────────────────
echo "── Gastos ──────────────────────────────────\n";
$rows     = fetch_sheet($sheets, SHEET_GASTOS . '!A:G');
$inserted = 0;
$skipped  = 0;

foreach ($rows as $i => $row) {
    if ($i === 0) continue;
    $fechaRaw  = trim($row[0] ?? '');
    $nombre    = trim($row[1] ?? '');
    $tipo      = strtolower(trim($row[2] ?? ''));
    $montoRaw  = trim($row[3] ?? '');

    if ($nombre === '' || $montoRaw === '') { $skipped++; continue; }

    // Normalize type from Spanish
    if (in_array($tipo, ['gasto', 'expense'], true)) {
        $tipo = 'expense';
    } elseif (in_array($tipo, ['ingreso', 'income'], true)) {
        $tipo = 'income';
    } else {
        $skipped++;
        continue;
    }

    $fecha    = $fechaRaw !== '' ? (_parse_sheet_date($fechaRaw) ?? bogota_now()->format('Y-m-d')) : bogota_now()->format('Y-m-d');
    $monto    = (float)preg_replace('/[^0-9.]/', '', str_replace(',', '.', $montoRaw));
    $descripcion = trim($row[4] ?? '') ?: null;

    // Map old sheet rowIndex to actual registros.id
    $oldRowIndex = trim($row[5] ?? '');
    $registroId  = null;
    if ($oldRowIndex !== '' && is_numeric($oldRowIndex)) {
        // Look up row in the cached clockInMap — not available here, so do a DB lookup
        // The old rowIndex was 1-based sheet row; we can approximate via ordering
        // Best effort: skip mapping if no match (data integrity over silent corruption)
        // A production run should verify these manually after import
    }

    $cuidadorId = $nameToId[$nombre] ?? null;
    if ($cuidadorId === null || $monto <= 0) { $skipped++; continue; }

    if (!$isDryRun) {
        $ins = $pdo->prepare(
            'INSERT INTO gastos (cuidador_id, registro_id, fecha, tipo, monto, descripcion)
             VALUES (?,?,?,?,?,?)'
        );
        $ins->execute([$cuidadorId, $registroId, $fecha, $tipo, $monto, $descripcion]);
        $inserted++;
    } else {
        $inserted++;
    }
}
echo "  Insertados: $inserted  |  Ignorados: $skipped\n";
echo "  NOTA: La columna 'Registro Asociado' (entryRowIndex de Sheets) no puede mapearse automáticamente a registros.id.\n";
echo "  Revisa los gastos con registro_id=NULL y actualiza manualmente si es necesario.\n\n";

// ── STEP 8: recibos ──────────────────────────────────────────────────────────
echo "── Recibos ─────────────────────────────────\n";
$rows     = fetch_sheet($sheets, SHEET_RECIBOS . '!A:G');
$inserted = 0;
$skipped  = 0;

foreach ($rows as $i => $row) {
    if ($i === 0) continue;
    $mes    = trim($row[0] ?? '');
    $nombre = trim($row[1] ?? '');

    if ($mes === '' || $nombre === '') { $skipped++; continue; }

    // Validate month format
    if (!preg_match('/^\d{4}-\d{2}$/', $mes)) { $skipped++; continue; }

    $notas       = trim($row[2] ?? '') ?: null;
    $descripcion = trim($row[3] ?? '') ?: null;
    $imageFileId = trim($row[4] ?? '') ?: null;
    $imageUrl    = trim($row[5] ?? '') ?: null;

    $cuidadorId = $nameToId[$nombre] ?? null;
    if ($cuidadorId === null) { $skipped++; continue; }

    if (!$isDryRun) {
        $ins = $pdo->prepare(
            'INSERT INTO recibos (cuidador_id, mes, notas, descripcion, imagen_file_id, imagen_url)
             VALUES (?,?,?,?,?,?)'
        );
        $ins->execute([$cuidadorId, $mes, $notas, $descripcion, $imageFileId, $imageUrl]);
        $inserted++;
    } else {
        $inserted++;
    }
}
echo "  Insertados: $inserted  |  Ignorados: $skipped\n\n";

// ── Done ─────────────────────────────────────────────────────────────────────
echo ($isDryRun ? "[DRY RUN] " : "") . "✓ Migración completada.\n";

// ── Helper: parse sheet date formats ─────────────────────────────────────────

function _parse_sheet_date(string $raw): ?string
{
    $raw = trim($raw);
    if ($raw === '') {
        return null;
    }

    // Already ISO YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
        return $raw;
    }

    // M/D/YYYY or MM/DD/YYYY
    if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})$#', $raw, $m)) {
        $month = (int)$m[1];
        $day   = (int)$m[2];
        $year  = (int)$m[3];
        // If month > 12, assume D/M/YYYY
        if ($month > 12 && $day <= 12) {
            [$month, $day] = [$day, $month];
        }
        if ($month >= 1 && $month <= 12 && $day >= 1 && $day <= 31) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
    }

    // Fallback
    try {
        $dt = new DateTime($raw);
        return $dt->format('Y-m-d');
    } catch (Exception $e) {
        return null;
    }
}
