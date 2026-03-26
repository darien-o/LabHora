<?php
/**
 * GET — Diagnóstico del backend PHP.
 * Accede a: https://tudominio.com/php-api/health.php
 * Elimina este archivo en producción cuando todo funcione.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$checks = [];

// 1. PHP version
$checks['php_version'] = PHP_VERSION;
$checks['php_ok'] = version_compare(PHP_VERSION, '8.0', '>=');

// 2. vendor/autoload.php
$autoload = __DIR__ . '/vendor/autoload.php';
$checks['vendor_exists'] = file_exists($autoload);

// 3. config.php
$config = __DIR__ . '/config.php';
$checks['config_exists'] = file_exists($config);

// 4. Config values (without exposing secrets)
if ($checks['config_exists']) {
    require_once $config;
    $checks['sheet_id_set'] = defined('GOOGLE_SHEET_ID') && !empty(GOOGLE_SHEET_ID);
    $checks['client_email_set'] = defined('GOOGLE_CLIENT_EMAIL') && !empty(GOOGLE_CLIENT_EMAIL);
    $checks['private_key_set'] = defined('GOOGLE_PRIVATE_KEY') && !empty(GOOGLE_PRIVATE_KEY);
    $checks['client_email_preview'] = defined('GOOGLE_CLIENT_EMAIL')
        ? substr(GOOGLE_CLIENT_EMAIL, 0, 10) . '...'
        : 'NOT SET';
}

// 5. Google API client
if ($checks['vendor_exists']) {
    require_once $autoload;
    $checks['google_client_class'] = class_exists('Google\Client');
    $checks['google_sheets_class'] = class_exists('Google\Service\Sheets');
}

// 6. Try connecting to Google Sheets
if (($checks['vendor_exists'] ?? false) && ($checks['config_exists'] ?? false) && ($checks['sheet_id_set'] ?? false)) {
    try {
        $client = new Google\Client();
        $client->setAuthConfig([
            'type' => 'service_account',
            'client_email' => GOOGLE_CLIENT_EMAIL,
            'private_key' => GOOGLE_PRIVATE_KEY,
            'token_uri' => 'https://oauth2.googleapis.com/token',
        ]);
        $client->setScopes([Google\Service\Sheets::SPREADSHEETS]);
        $service = new Google\Service\Sheets($client);

        $resp = $service->spreadsheets->get(GOOGLE_SHEET_ID);
        $checks['sheets_connection'] = 'OK';
        $checks['spreadsheet_title'] = $resp->getProperties()->getTitle();
    } catch (Exception $e) {
        $checks['sheets_connection'] = 'ERROR';
        $checks['sheets_error'] = $e->getMessage();
    }
}

// Overall status
$allOk = ($checks['php_ok'] ?? false)
    && ($checks['vendor_exists'] ?? false)
    && ($checks['config_exists'] ?? false)
    && ($checks['sheet_id_set'] ?? false)
    && ($checks['client_email_set'] ?? false)
    && ($checks['private_key_set'] ?? false)
    && (($checks['sheets_connection'] ?? '') === 'OK');

$checks['status'] = $allOk ? 'ALL_OK' : 'HAS_ISSUES';

echo json_encode($checks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
