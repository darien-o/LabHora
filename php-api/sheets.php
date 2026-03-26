<?php
/**
 * Módulo central de Google Sheets — autenticación y helpers.
 */

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/config.php';

function cors_headers() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Cache-Control: no-cache, no-store, must-revalidate');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function get_sheets_service(): Google\Service\Sheets {
    $client = new Google\Client();
    $client->setAuthConfig([
        'type' => 'service_account',
        'client_email' => GOOGLE_CLIENT_EMAIL,
        'private_key' => GOOGLE_PRIVATE_KEY,
        'token_uri' => 'https://oauth2.googleapis.com/token',
    ]);
    $client->setScopes([Google\Service\Sheets::SPREADSHEETS]);
    return new Google\Service\Sheets($client);
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

/**
 * Convierte un timestamp ISO a formato DD/MM/YYYY, HH:mm:ss en zona GMT-5.
 */
function format_datetime_for_sheet(string $isoTimestamp): string {
    $dt = new DateTime($isoTimestamp);
    $dt->setTimezone(new DateTimeZone('America/Bogota'));
    return $dt->format('d/m/Y, H:i:s');
}

/**
 * Parsea "DD/MM/YYYY, HH:mm:ss" a DateTime en zona Bogotá.
 */
function parse_spanish_datetime(string $dateTimeStr): DateTime {
    $parts = explode(', ', $dateTimeStr);
    if (count($parts) !== 2) {
        throw new Exception("Formato de fecha inválido: $dateTimeStr");
    }
    [$datePart, $timePart] = $parts;
    [$day, $month, $year] = explode('/', $datePart);
    return new DateTime("$year-$month-$day $timePart", new DateTimeZone('America/Bogota'));
}
