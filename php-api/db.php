<?php
/**
 * db.php — Shared database layer.
 *
 * Include this at the top of every endpoint:
 *   require_once __DIR__ . '/db.php';
 *
 * Provides:
 *   get_pdo()             — hardened PDO singleton
 *   cors_headers()        — CORS + HTTP security headers (call once per request)
 *   json_response($data)  — send JSON and exit
 *   json_error($msg, $n)  — send error JSON and exit (never leaks internals)
 *   get_json_body()       — parse + validate request body (max 64 KB)
 *   sanitize_string()     — trim + htmlspecialchars + length cap
 *   validate_int()        — cast and range-check integers
 *   validate_date()       — validate YYYY-MM-DD strings
 *   validate_month()      — validate YYYY-MM strings
 *   validate_time()       — validate HH:MM strings
 *   validate_enum()       — check value is in allowed set
 *   bogota_now()          — current DateTime in America/Bogota
 *   utc_to_bogota()       — convert UTC datetime string to Bogotá DateTime
 *   bogota_to_utc()       — convert Bogotá datetime string to UTC DateTime
 *   format_for_sheet()    — format a DateTime as Spanish "DD/MM/YYYY, HH:mm:ss"
 *   parse_spanish_datetime() — parse Spanish-formatted datetime → DateTime (UTC)
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

// ── Config ────────────────────────────────────────────────────────────────────
$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Configuración no encontrada.']);
    exit;
}
require_once $configPath;

// ── PDO singleton ─────────────────────────────────────────────────────────────
$_pdo_instance = null;

function get_pdo(): PDO
{
    global $_pdo_instance;
    if ($_pdo_instance !== null) {
        return $_pdo_instance;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        defined('DB_HOST') ? DB_HOST : '127.0.0.1',
        defined('DB_PORT') ? DB_PORT : '3306',
        defined('DB_NAME') ? DB_NAME : ''
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES   => false,  // CRITICAL: use real prepared statements
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+00:00'",
    ];

    try {
        $_pdo_instance = new PDO(
            $dsn,
            defined('DB_USER') ? DB_USER : '',
            defined('DB_PASS') ? DB_PASS : '',
            $options
        );
    } catch (PDOException $e) {
        error_log('[db.php] Connection failed: ' . $e->getMessage());
        // NEVER expose DB details to the client
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Error de conexión a la base de datos.']);
        exit;
    }

    return $_pdo_instance;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/**
 * Send CORS headers and HTTP security headers.
 * Must be called before any output on every request.
 */
function cors_headers(string $allowedMethods = 'GET, POST, OPTIONS'): void
{
    $origin = defined('ALLOWED_ORIGIN') ? ALLOWED_ORIGIN : '*';

    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: ' . $allowedMethods);
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
    header('Access-Control-Max-Age: 3600');

    // Security headers — prevent common web attacks
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: no-referrer');
    header('Content-Security-Policy: default-src \'none\'');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/**
 * Send a successful JSON response and exit.
 *
 * @param mixed $data
 */
function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Send an error JSON response and exit.
 * NEVER pass $e->getMessage() for unexpected/server errors — use a generic message.
 */
function json_error(string $message, int $status = 500): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Parse and return the JSON request body as an array.
 * Rejects if body exceeds 64 KB or is not valid JSON.
 */
function get_json_body(): array
{
    $maxBytes = 65536; // 64 KB

    // Check Content-Length if provided
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > $maxBytes) {
        json_error('Payload demasiado grande.', 413);
    }

    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false) {
        json_error('No se pudo leer el cuerpo de la solicitud.', 400);
    }
    if (strlen($raw) > $maxBytes) {
        json_error('Payload demasiado grande.', 413);
    }
    if ($raw === '') {
        json_error('Cuerpo de solicitud vacío.', 400);
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_error('JSON inválido en el cuerpo de la solicitud.', 400);
    }

    return $data;
}

// ── Input validation & sanitization ──────────────────────────────────────────

/**
 * Sanitize a string input: trim, strip tags, htmlspecialchars, cap length.
 * Returns empty string if input is null/empty.
 */
function sanitize_string(?string $value, int $maxLen = 255): string
{
    if ($value === null || $value === '') {
        return '';
    }
    $value = trim($value);
    $value = strip_tags($value);
    $value = htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return mb_substr($value, 0, $maxLen, 'UTF-8');
}

/**
 * Validate and return an integer within the given range.
 * Calls json_error(400) if invalid.
 */
function validate_int($value, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX): int
{
    if (!is_numeric($value) || (string)(int)$value !== (string)$value) {
        json_error('Valor numérico entero inválido.', 400);
    }
    $int = (int)$value;
    if ($int < $min || $int > $max) {
        json_error("Valor fuera de rango ($min–$max).", 400);
    }
    return $int;
}

/**
 * Validate a date string in YYYY-MM-DD format.
 * Calls json_error(400) if invalid.
 */
function validate_date(string $value): string
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        json_error('Formato de fecha inválido. Use YYYY-MM-DD.', 400);
    }
    $d = DateTime::createFromFormat('Y-m-d', $value);
    if (!$d || $d->format('Y-m-d') !== $value) {
        json_error('Fecha inválida.', 400);
    }
    return $value;
}

/**
 * Validate a month string in YYYY-MM format.
 * Calls json_error(400) if invalid.
 */
function validate_month(string $value): string
{
    if (!preg_match('/^\d{4}-\d{2}$/', $value)) {
        json_error('Formato de mes inválido. Use YYYY-MM.', 400);
    }
    [$y, $m] = explode('-', $value);
    if ((int)$m < 1 || (int)$m > 12) {
        json_error('Mes inválido.', 400);
    }
    return $value;
}

/**
 * Validate a time string in HH:MM or HH:MM:SS format.
 * Normalizes to HH:MM:SS. Calls json_error(400) if invalid.
 */
function validate_time(string $value): string
{
    $value = trim($value);
    // Accept HH:MM or HH:MM:SS
    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $value)) {
        json_error('Formato de hora inválido. Use HH:MM o HH:MM:SS.', 400);
    }
    $d = DateTime::createFromFormat('H:i', substr($value, 0, 5));
    if (!$d) {
        json_error('Hora inválida.', 400);
    }
    // Normalize to HH:MM:SS
    return substr($value, 0, 5) . ':00';
}

/**
 * Validate that a value is in an explicit allowed set.
 * Calls json_error(400) if not found.
 */
function validate_enum($value, array $allowed): string
{
    $value = (string)$value;
    if (!in_array($value, $allowed, true)) {
        json_error('Valor no permitido: ' . $value . '. Opciones: ' . implode(', ', $allowed), 400);
    }
    return $value;
}

// ── DateTime helpers ──────────────────────────────────────────────────────────

/** Return current DateTime in America/Bogotá timezone. */
function bogota_now(): DateTime
{
    return new DateTime('now', new DateTimeZone('America/Bogota'));
}

/**
 * Convert a UTC DATETIME string (from DB) to a DateTime in Bogotá timezone.
 */
function utc_to_bogota(string $utcDatetime): DateTime
{
    $dt = new DateTime($utcDatetime, new DateTimeZone('UTC'));
    $dt->setTimezone(new DateTimeZone('America/Bogota'));
    return $dt;
}

/**
 * Convert a Bogotá datetime string (or any ISO string) to a UTC DateTime.
 */
function bogota_to_utc(string $datetime): DateTime
{
    // If it already has timezone info (Z or +00:00), parse directly
    if (str_ends_with($datetime, 'Z') || preg_match('/[+-]\d{2}:\d{2}$/', $datetime)) {
        $dt = new DateTime($datetime);
        $dt->setTimezone(new DateTimeZone('UTC'));
        return $dt;
    }
    // Assume Bogotá local time
    $dt = new DateTime($datetime, new DateTimeZone('America/Bogota'));
    $dt->setTimezone(new DateTimeZone('UTC'));
    return $dt;
}

/**
 * Format a DateTime as the Spanish sheet format: "DD/MM/YYYY, HH:mm:ss"
 * Used by the backup sync script.
 */
function format_for_sheet(DateTime $dt): string
{
    $dt->setTimezone(new DateTimeZone('America/Bogota'));
    return $dt->format('d/m/Y, H:i:s');
}

/**
 * Parse a Spanish-formatted datetime string "DD/MM/YYYY, HH:mm:ss" into a UTC DateTime.
 * Used by the migration script when reading old Sheets data.
 */
function parse_spanish_datetime(string $dateTimeStr): DateTime
{
    $parts = explode(', ', $dateTimeStr);
    if (count($parts) !== 2) {
        throw new Exception("Formato de fecha inválido: $dateTimeStr");
    }
    [$datePart, $timePart] = $parts;
    $datePieces = explode('/', $datePart);
    if (count($datePieces) !== 3) {
        throw new Exception("Parte de fecha inválida: $datePart");
    }
    [$day, $month, $year] = $datePieces;
    $dt = new DateTime(
        sprintf('%04d-%02d-%02d %s', (int)$year, (int)$month, (int)$day, $timePart),
        new DateTimeZone('America/Bogota')
    );
    $dt->setTimezone(new DateTimeZone('UTC'));
    return $dt;
}

/**
 * Resolve a caregiver name to their DB id.
 * Calls json_error(404) if not found.
 */
function resolve_cuidador_id(PDO $pdo, string $nombre): int
{
    $stmt = $pdo->prepare('SELECT id FROM cuidadores WHERE nombre = ? LIMIT 1');
    $stmt->execute([$nombre]);
    $id = $stmt->fetchColumn();
    if ($id === false) {
        json_error("Cuidador no encontrado: $nombre", 404);
    }
    return (int)$id;
}
