<?php
/**
 * Recibos de pago — CRUD con imagen.
 * Sheet "Recibos": A=Mes, B=Cuidador, C=Notas, D=Descripción,
 *                  E=Imagen ID, F=Imagen URL, G=Fecha Registro
 *
 * GET  — Lista todos los recibos, con filtro opcional por mes (?month=YYYY-MM)
 * POST — Crear recibo con notas, descripción e imagen (multipart/form-data)
 *         Campos: month, personName, notes, description, image (file)
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

if (!defined('SHEET_RECIBOS')) {
    define('SHEET_RECIBOS', 'Recibos');
}

try {
    $service = get_sheets_service();
    $sheetId = GOOGLE_SHEET_ID;

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $resp = $service->spreadsheets_values->get($sheetId, SHEET_RECIBOS . '!A:G');
        $rows = $resp->getValues() ?? [];

        $monthFilter = isset($_GET['month']) ? trim($_GET['month']) : '';

        $recibos = [];
        for ($i = 1; $i < count($rows); $i++) {
            $r = $rows[$i];
            if (empty($r[0]) && empty($r[1])) continue;

            $month = trim($r[0] ?? '');

            // Apply month filter if provided
            if ($monthFilter !== '' && $month !== $monthFilter) continue;

            $recibos[] = [
                'rowIndex'    => $i + 1,
                'month'       => $month,
                'personName'  => trim($r[1] ?? ''),
                'notes'       => trim($r[2] ?? ''),
                'description' => trim($r[3] ?? ''),
                'imageFileId' => trim($r[4] ?? ''),
                'imageUrl'    => trim($r[5] ?? ''),
                'createdAt'   => trim($r[6] ?? ''),
            ];
        }

        json_response($recibos);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // POST expects multipart/form-data with fields:
        //   month, personName, notes, description, image (file, optional)
        $month       = trim($_POST['month'] ?? '');
        $personName  = trim($_POST['personName'] ?? '');
        $notes       = trim($_POST['notes'] ?? '');
        $description = trim($_POST['description'] ?? '');

        if (!$month || !$personName) {
            json_error('Faltan datos requeridos (mes, cuidador)', 400);
        }

        $imageFileId = '';
        $imageUrl    = '';

        // Handle image upload to Google Drive if provided
        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['image'];

            // Validate file type
            $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
            if (!in_array($file['type'], $allowedTypes) && !preg_match('/^image\//', $file['type'])) {
                json_error('Tipo de archivo no permitido. Solo imágenes.', 400);
            }

            // Validate file size (10MB max)
            if ($file['size'] > 10 * 1024 * 1024) {
                json_error('La imagen es demasiado grande. Máximo 10MB.', 400);
            }

            // Initialize Google Drive service
            $client = new Google\Client();
            $client->setAuthConfig([
                'type' => 'service_account',
                'client_email' => GOOGLE_CLIENT_EMAIL,
                'private_key' => GOOGLE_PRIVATE_KEY,
                'token_uri' => 'https://oauth2.googleapis.com/token',
            ]);
            $client->setScopes([
                Google\Service\Drive::DRIVE_FILE,
            ]);

            $driveService = new Google\Service\Drive($client);

            // Create filename
            $date = date('Y-m-d_H-i-s');
            $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $personName);
            $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
            $fileName = "recibo_{$safeName}_{$month}_{$date}.{$ext}";

            // Check for Drive folder
            $folderId = null;
            if (defined('GOOGLE_DRIVE_FOLDER_ID') && !empty(GOOGLE_DRIVE_FOLDER_ID)) {
                $folderId = GOOGLE_DRIVE_FOLDER_ID;
            }

            // Upload to Drive
            $driveFile = new Google\Service\Drive\DriveFile();
            $driveFile->setName($fileName);
            $driveFile->setDescription("Recibo de pago - $personName - $month");
            if ($folderId) {
                $driveFile->setParents([$folderId]);
            }

            $result = $driveService->files->create($driveFile, [
                'data' => file_get_contents($file['tmp_name']),
                'mimeType' => $file['type'],
                'uploadType' => 'multipart',
                'fields' => 'id, webViewLink',
            ]);

            // Make file viewable by anyone with link
            $permission = new Google\Service\Drive\Permission();
            $permission->setType('anyone');
            $permission->setRole('reader');
            $driveService->permissions->create($result->id, $permission);

            $imageFileId = $result->id;
            $imageUrl    = $result->webViewLink;
        }

        // Append row to Recibos sheet
        $now = (new DateTime('now', new DateTimeZone('America/Bogota')))->format('d/m/Y H:i');

        $body = new Google\Service\Sheets\ValueRange();
        $body->setValues([[$month, $personName, $notes, $description, $imageFileId, $imageUrl, $now]]);

        $service->spreadsheets_values->append(
            $sheetId,
            SHEET_RECIBOS . '!A:G',
            $body,
            ['valueInputOption' => 'USER_ENTERED', 'insertDataOption' => 'INSERT_ROWS']
        );

        json_response([
            'success'     => true,
            'message'     => 'Recibo creado',
            'imageFileId' => $imageFileId,
            'imageUrl'    => $imageUrl,
        ]);

    } else {
        json_error('Método no permitido', 405);
    }
} catch (Exception $e) {
    json_error('Error en recibos: ' . $e->getMessage());
}
