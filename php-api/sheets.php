<?php
/**
 * Módulo central de Google Sheets — autenticación y helpers.
 */

// Show errors in response during debugging (remove in production)
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Check vendor autoload exists
$autoloadPath = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoloadPath)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'vendor/autoload.php no encontrado. Ejecuta: composer install en php-api/']);
    exit;
}
require_once $autoloadPath;

// Check config exists
$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'config.php no encontrado. Copia config.example.php a config.php y completa las credenciales.']);
    exit;
}
require_once $configPath;

// Validate required constants
if (!defined('GOOGLE_SHEET_ID') || !defined('GOOGLE_CLIENT_EMAIL') || !defined('GOOGLE_PRIVATE_KEY')) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'config.php incompleto. Verifica GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY.']);
    exit;
}

if (empty(GOOGLE_SHEET_ID) || empty(GOOGLE_CLIENT_EMAIL) || empty(GOOGLE_PRIVATE_KEY)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Las credenciales en config.php están vacías. Completa los valores.']);
    exit;
}

function cors_headers() {
    $origin = defined('ALLOWED_ORIGIN') ? ALLOWED_ORIGIN : '*';
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Cache-Control: no-cache, no-store, must-revalidate');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function get_sheets_service(): Google\Service\Sheets {
    try {
        $client = new Google\Client();
        $client->setAuthConfig([
            'type' => 'service_account',
            'client_email' => GOOGLE_CLIENT_EMAIL,
            'private_key' => GOOGLE_PRIVATE_KEY,
            'token_uri' => 'https://oauth2.googleapis.com/token',
        ]);
        $client->setScopes([Google\Service\Sheets::SPREADSHEETS]);
        return new Google\Service\Sheets($client);
    } catch (Exception $e) {
        json_error('Error de autenticación con Google: ' . $e->getMessage());
        exit; // unreachable but makes static analysis happy
    }
}

function json_response($data, int $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 500) {
    json_response(['error' => $message], $status);
}

function get_json_body(): array {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    if (!is_array($data)) {
        json_error('Cuerpo JSON inválido', 400);
    }
    return $data;
}

function format_datetime_for_sheet(string $isoTimestamp): string {
    $dt = new DateTime($isoTimestamp);
    $dt->setTimezone(new DateTimeZone('America/Bogota'));
    return $dt->format('d/m/Y, H:i:s');
}

function parse_spanish_datetime(string $dateTimeStr): DateTime {
    $str = trim($dateTimeStr);

    // Format 1 (canonical, written by app): "DD/MM/YYYY, HH:mm:ss"
    // Format 2 (legacy, no comma, no zero-padding): "D/M/YYYY H:mm:ss"
    // Normalize: remove the optional comma so both become "DD/MM/YYYY HH:mm:ss"
    $normalized = str_replace(', ', ' ', $str);

    // Split on the space between date and time parts
    $parts = explode(' ', $normalized, 2);
    if (count($parts) !== 2) {
        throw new Exception("Formato de fecha inválido: $dateTimeStr");
    }
    [$datePart, $timePart] = $parts;

    $datePieces = explode('/', $datePart);
    if (count($datePieces) !== 3) {
        throw new Exception("Formato de fecha inválido: $dateTimeStr");
    }
    [$day, $month, $year] = $datePieces;

    return new DateTime(
        sprintf('%04d-%02d-%02d %s', (int)$year, (int)$month, (int)$day, $timePart),
        new DateTimeZone('America/Bogota')
    );
}
