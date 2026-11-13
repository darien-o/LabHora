<?php
/**
 * sync-to-sheets.php — Append-only backup sync: MySQL → Google Sheets.
 *
 * CLI ONLY — HTTP access is blocked via .htaccess.
 *
 * Behavior:
 *   - Reads last synced id per table from a "_sync_meta" tab in Google Sheets.
 *   - Fetches rows with id > last_synced_id from each MySQL table (max 500 per run).
 *   - Appends new rows to the corresponding Sheets tab WITHOUT touching existing rows.
 *   - Updates _sync_meta with the new last_synced_id.
 *
 * Usage:
 *   php php-api/sync-to-sheets.php
 *
 * Cron example (nightly at 3 AM, Hostinger):
 *   0 3 * * * /usr/bin/php /home/USERNAME/public_html/php-api/sync-to-sheets.php >> /home/USERNAME/logs/sync.log 2>&1
 *
 * First run:
 *   Automatically creates the _sync_meta tab if it doesn't exist.
 */

declare(strict_types=1);

// ── CLI guard ─────────────────────────────────────────────────────────────────
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Este script solo puede ejecutarse desde la línea de comandos.']);
    exit(1);
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
require_once __DIR__ . '/db.php';

const BATCH_SIZE  = 500;
const META_SHEET  = '_sync_meta';

// ── Google Sheets service ─────────────────────────────────────────────────────
function make_sheets_service(): Google\Service\Sheets
{
    $client = new Google\Client();
    $client->setAuthConfig([
        'type'         => 'service_account',
        'client_email' => GOOGLE_CLIENT_EMAIL,
        'private_key'  => GOOGLE_PRIVATE_KEY,
        'token_uri'    => 'https://oauth2.googleapis.com/token',
    ]);
    $client->setScopes([Google\Service\Sheets::SPREADSHEETS]);
    return new Google\Service\Sheets($client);
}

$pdo    = get_pdo();
$sheets = make_sheets_service();
$sheetId = GOOGLE_SHEET_ID;

echo "[sync] " . date('Y-m-d H:i:s') . " — Iniciando sincronización.\n";

// ── Read or create _sync_meta ─────────────────────────────────────────────────
$lastSynced = _read_sync_meta($sheets, $sheetId);

// ── Sync each table ───────────────────────────────────────────────────────────
$tables = [
    'cuidadores'  => ['sheet' => SHEET_CUIDADORES,  'fn' => '_rows_cuidadores'],
    'registros'   => ['sheet' => SHEET_REGISTRO,    'fn' => '_rows_registros'],
    'turnos'      => ['sheet' => SHEET_TURNOS,      'fn' => '_rows_turnos'],
    'bloqueos'    => ['sheet' => SHEET_BLOQUEOS,    'fn' => '_rows_bloqueos'],
    'recaudos'    => ['sheet' => SHEET_RECAUDOS,    'fn' => '_rows_recaudos'],
    'anticipos'   => ['sheet' => SHEET_ANTICIPOS,   'fn' => '_rows_anticipos'],
    'gastos'      => ['sheet' => SHEET_GASTOS,      'fn' => '_rows_gastos'],
    'recibos'     => ['sheet' => SHEET_RECIBOS,     'fn' => '_rows_recibos'],
];

foreach ($tables as $tableName => $cfg) {
    $since  = $lastSynced[$tableName] ?? 0;
    $fn     = $cfg['fn'];
    $rows   = $fn($pdo, $since);

    if (empty($rows)) {
        echo "[sync] $tableName: 0 filas nuevas.\n";
        continue;
    }

    // Append to the corresponding Sheets tab
    $range  = $cfg['sheet'] . '!A:A'; // API appends after last row regardless of range
    $body   = new Google\Service\Sheets\ValueRange();
    $body->setValues($rows);

    $sheets->spreadsheets_values->append(
        $sheetId,
        $range,
        $body,
        ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
    );

    // Track the highest id synced in this batch
    $lastId = $rows[count($rows) - 1][0]; // first column is always the id
    $lastSynced[$tableName] = (int)$lastId;

    echo "[sync] $tableName: " . count($rows) . " filas appended (last_id: $lastId).\n";
}

// ── Update _sync_meta in Sheets ───────────────────────────────────────────────
_write_sync_meta($sheets, $sheetId, $lastSynced);

echo "[sync] " . date('Y-m-d H:i:s') . " — Sincronización completada.\n";

// ── Row formatters ────────────────────────────────────────────────────────────

function _rows_cuidadores(PDO $pdo, int $since): array
{
    $stmt = $pdo->prepare(
        'SELECT id, nombre, pago_fijo, tarifa_cop
         FROM cuidadores WHERE id > ? ORDER BY id ASC LIMIT ' . BATCH_SIZE
    );
    $stmt->execute([$since]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            $r['id'],
            $r['nombre'],
            $r['pago_fijo'] ? 'Sí' : 'No',
            $r['tarifa_cop'] ?? '',
        ];
    }
    return $rows;
}

function _rows_registros(PDO $pdo, int $since): array
{
    $stmt = $pdo->prepare(
        "SELECT r.id, r.clock_in, r.clock_out, c.nombre, r.total_horas,
                r.pagado, r.valor_hora, r.notas, r.imagenes,
                r.confirmado_cuidador, r.fecha_confirmacion, r.monto_confirmado
         FROM registros r
         JOIN cuidadores c ON c.id = r.cuidador_id
         WHERE r.id > ? ORDER BY r.id ASC LIMIT " . BATCH_SIZE
    );
    $stmt->execute([$since]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            $r['id'],
            $r['clock_in']  ? format_for_sheet(utc_to_bogota($r['clock_in']))  : '',
            $r['clock_out'] ? format_for_sheet(utc_to_bogota($r['clock_out'])) : '',
            $r['nombre'],
            $r['total_horas'] ?? '',
            $r['pagado'] ? 'Sí' : 'No',
            $r['valor_hora'] ?? '',
            $r['notas'] ?? '',
            $r['imagenes'] ?? '',
            $r['confirmado_cuidador'] ? 'Sí' : 'No',
            $r['fecha_confirmacion'] ? format_for_sheet(utc_to_bogota($r['fecha_confirmacion'])) : '',
            $r['monto_confirmado'] ?? '',
        ];
    }
    return $rows;
}

function _rows_turnos(PDO $pdo, int $since): array
{
    $stmt = $pdo->prepare(
        'SELECT t.id, t.fecha, c.nombre, t.hora_inicio, t.hora_fin
         FROM turnos t JOIN cuidadores c ON c.id = t.cuidador_id
         WHERE t.id > ? ORDER BY t.id ASC LIMIT ' . BATCH_SIZE
    );
    $stmt->execute([$since]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            $r['id'],
            $r['fecha'],
            $r['nombre'],
            substr($r['hora_inicio'], 0, 5),
            substr($r['hora_fin'],    0, 5),
        ];
    }
    return $rows;
}

function _rows_bloqueos(PDO $pdo, int $since): array
{
    $stmt = $pdo->prepare(
        'SELECT b.id, c.nombre, b.fecha_inicio, b.fecha_fin,
                b.hora_inicio, b.hora_fin, b.repetir, b.repetir_hasta, b.motivo
         FROM bloqueos b JOIN cuidadores c ON c.id = b.cuidador_id
         WHERE b.id > ? ORDER BY b.id ASC LIMIT ' . BATCH_SIZE
    );
    $stmt->execute([$since]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            $r['id'],
            $r['nombre'],
            $r['fecha_inicio'],
            $r['fecha_fin'],
            substr($r['hora_inicio'], 0, 5),
            substr($r['hora_fin'],    0, 5),
            $r['repetir'] ?? '',
            $r['repetir_hasta'] ?? '',
            $r['motivo'] ?? '',
        ];
    }
    return $rows;
}

function _rows_recaudos(PDO $pdo, int $since): array
{
    $stmt = $pdo->prepare(
        'SELECT id, mes, monto, descripcion
         FROM recaudos WHERE id > ? ORDER BY id ASC LIMIT ' . BATCH_SIZE
    );
    $stmt->execute([$since]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            $r['id'],
            $r['mes'],
            $r['monto'],
            $r['descripcion'] ?? '',
        ];
    }
    return $rows;
}

function _rows_anticipos(PDO $pdo, int $since): array
{
    $stmt = $pdo->prepare(
        'SELECT a.id, a.fecha, a.mes, c.nombre, a.monto, a.descripcion,
                a.confirmado, a.fecha_confirmacion
         FROM anticipos a JOIN cuidadores c ON c.id = a.cuidador_id
         WHERE a.id > ? ORDER BY a.id ASC LIMIT ' . BATCH_SIZE
    );
    $stmt->execute([$since]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            $r['id'],
            $r['fecha'],
            $r['mes'],
            $r['nombre'],
            $r['monto'],
            $r['descripcion'] ?? '',
            $r['confirmado'] ? 'Sí' : 'No',
            $r['fecha_confirmacion'] ? format_for_sheet(utc_to_bogota($r['fecha_confirmacion'])) : '',
        ];
    }
    return $rows;
}

function _rows_gastos(PDO $pdo, int $since): array
{
    $stmt = $pdo->prepare(
        'SELECT g.id, g.fecha, c.nombre, g.tipo, g.monto, g.descripcion, g.registro_id
         FROM gastos g JOIN cuidadores c ON c.id = g.cuidador_id
         WHERE g.id > ? ORDER BY g.id ASC LIMIT ' . BATCH_SIZE
    );
    $stmt->execute([$since]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            $r['id'],
            $r['fecha'],
            $r['nombre'],
            $r['tipo'],
            $r['monto'],
            $r['descripcion'] ?? '',
            $r['registro_id'] ?? '',
        ];
    }
    return $rows;
}

function _rows_recibos(PDO $pdo, int $since): array
{
    $stmt = $pdo->prepare(
        'SELECT r.id, r.mes, c.nombre, r.notas, r.descripcion,
                r.imagen_file_id, r.imagen_url
         FROM recibos r JOIN cuidadores c ON c.id = r.cuidador_id
         WHERE r.id > ? ORDER BY r.id ASC LIMIT ' . BATCH_SIZE
    );
    $stmt->execute([$since]);
    $rows = [];
    foreach ($stmt->fetchAll() as $r) {
        $rows[] = [
            $r['id'],
            $r['mes'],
            $r['nombre'],
            $r['notas'] ?? '',
            $r['descripcion'] ?? '',
            $r['imagen_file_id'] ?? '',
            $r['imagen_url'] ?? '',
        ];
    }
    return $rows;
}

// ── _sync_meta helpers ────────────────────────────────────────────────────────

/**
 * Read last_synced_id per table from the _sync_meta sheet tab.
 * Creates the tab with headers if it doesn't exist.
 * Returns ['tableName' => lastId, ...]
 */
function _read_sync_meta(Google\Service\Sheets $sheets, string $sheetId): array
{
    try {
        $resp = $sheets->spreadsheets_values->get($sheetId, META_SHEET . '!A:B');
        $rows = $resp->getValues() ?? [];
    } catch (Google\Service\Exception $e) {
        if (str_contains($e->getMessage(), 'Unable to parse range')) {
            // Tab doesn't exist — create it
            _create_sync_meta_tab($sheets, $sheetId);
            return [];
        }
        throw $e;
    }

    $meta = [];
    foreach ($rows as $i => $row) {
        if ($i === 0) continue; // header
        if (!empty($row[0]) && isset($row[1])) {
            $meta[trim($row[0])] = (int)$row[1];
        }
    }
    return $meta;
}

/**
 * Write back the updated last_synced_id map to _sync_meta.
 * Clears and rewrites the meta sheet (it only holds sync state, not user data).
 */
function _write_sync_meta(Google\Service\Sheets $sheets, string $sheetId, array $meta): void
{
    $rows = [['table_name', 'last_synced_id']];
    foreach ($meta as $table => $lastId) {
        $rows[] = [$table, $lastId];
    }

    $body = new Google\Service\Sheets\ValueRange();
    $body->setValues($rows);

    // Clear then rewrite meta tab
    $sheets->spreadsheets_values->clear(
        $sheetId,
        META_SHEET . '!A:B',
        new Google\Service\Sheets\ClearValuesRequest()
    );

    $sheets->spreadsheets_values->update(
        $sheetId,
        META_SHEET . '!A1',
        $body,
        ['valueInputOption' => 'RAW']
    );
}

/**
 * Create the _sync_meta sheet tab via the spreadsheets.batchUpdate API.
 */
function _create_sync_meta_tab(Google\Service\Sheets $sheets, string $sheetId): void
{
    $request = new Google\Service\Sheets\Request([
        'addSheet' => [
            'properties' => [
                'title'  => META_SHEET,
                'hidden' => true,
            ],
        ],
    ]);
    $body = new Google\Service\Sheets\BatchUpdateSpreadsheetRequest([
        'requests' => [$request],
    ]);
    $sheets->spreadsheets->batchUpdate($sheetId, $body);

    // Write header row
    $headerBody = new Google\Service\Sheets\ValueRange();
    $headerBody->setValues([['table_name', 'last_synced_id']]);
    $sheets->spreadsheets_values->update(
        $sheetId,
        META_SHEET . '!A1',
        $headerBody,
        ['valueInputOption' => 'RAW']
    );

    echo "[sync] Pestaña _sync_meta creada en Google Sheets.\n";
}
