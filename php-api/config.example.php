<?php
/**
 * Configuración de credenciales Google Sheets.
 *
 * Copia este archivo como config.php y completa los valores.
 * NUNCA subas config.php al repositorio.
 */

define('GOOGLE_SHEET_ID', '');
define('GOOGLE_CLIENT_EMAIL', '');
define('GOOGLE_PRIVATE_KEY', '-----BEGIN PRIVATE KEY-----
PEGA_TU_CLAVE_PRIVADA_AQUI
-----END PRIVATE KEY-----');

define('SHEET_REGISTRO', 'Registro');
define('SHEET_CUIDADORES', 'Cuidadores');

// Cambiar a 'https://tudominio.com' en producción
define('ALLOWED_ORIGIN', '*');
