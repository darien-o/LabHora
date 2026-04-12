<?php
/**
 * POST — Sube una foto a Google Drive y devuelve el link.
 * Expects multipart/form-data with:
 *   - photo: file
 *   - personName: string
 *   - note: string (optional)
 */
require_once __DIR__ . '/sheets.php';
cors_headers();

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if (empty($_FILES['photo'])) {
        json_error('No se recibió ninguna foto', 400);
    }

    $file = $_FILES['photo'];
    $personName = $_POST['personName'] ?? 'Desconocido';
    $note = $_POST['note'] ?? '';

    // Validate file
    $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!in_array($file['type'], $allowedTypes) && !preg_match('/^image\//', $file['type'])) {
        json_error('Tipo de archivo no permitido. Solo imágenes.', 400);
    }

    if ($file['size'] > 10 * 1024 * 1024) { // 10MB max
        json_error('La foto es demasiado grande. Máximo 10MB.', 400);
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
        Google\Service\Sheets::SPREADSHEETS,
    ]);

    $driveService = new Google\Service\Drive($client);

    // Create filename with date and person name
    $date = date('Y-m-d_H-i-s');
    $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $personName);
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
    $fileName = "marujita_{$safeName}_{$date}.{$ext}";

    // Check/create folder
    $folderId = null;
    if (defined('GOOGLE_DRIVE_FOLDER_ID') && !empty(GOOGLE_DRIVE_FOLDER_ID)) {
        $folderId = GOOGLE_DRIVE_FOLDER_ID;
    }

    // Upload to Drive
    $driveFile = new Google\Service\Drive\DriveFile();
    $driveFile->setName($fileName);
    $driveFile->setDescription("Foto de $personName - $date" . ($note ? " - Nota: $note" : ""));
    if ($folderId) {
        $driveFile->setParents([$folderId]);
    }

    $result = $driveService->files->create($driveFile, [
        'data' => file_get_contents($file['tmp_name']),
        'mimeType' => $file['type'],
        'uploadType' => 'multipart',
        'fields' => 'id, webViewLink, webContentLink',
    ]);

    // Make file viewable by anyone with link
    $permission = new Google\Service\Drive\Permission();
    $permission->setType('anyone');
    $permission->setRole('reader');
    $driveService->permissions->create($result->id, $permission);

    // Also log to the sheet if there's a note
    if ($note) {
        $sheetsService = new Google\Service\Sheets($client);
        // We'll append to a "Notas" column if it exists, but for now just return the data
    }

    json_response([
        'success' => true,
        'fileId' => $result->id,
        'viewLink' => $result->webViewLink,
        'downloadLink' => $result->webContentLink,
        'fileName' => $fileName,
    ]);

} catch (Exception $e) {
    json_error('Error al subir foto: ' . $e->getMessage());
}
