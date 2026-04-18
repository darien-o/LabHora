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

define('SHEET_REGISTRO', 'Registro');    // Columnas: Entrada | Salida | Nombre | Horas | Pagado | Valor Hora
define('SHEET_CUIDADORES', 'Cuidadores'); // Columnas: Nombre | Pago Fijo (Sí/No) | Tarifa (COP valor hora)
define('SHEET_TURNOS', 'Turnos');  // Crear esta pestaña en Google Sheets con columnas: Fecha | Cuidador | Hora Inicio | Hora Fin
define('SHEET_RECAUDOS', 'Recaudos'); // Columnas: Mes (YYYY-MM) | Monto | Descripción | Fecha Registro

// Cambiar a 'https://tudominio.com' en producción
define('ALLOWED_ORIGIN', '*');

// Google Drive folder ID para fotos (crear carpeta en Drive y compartir con la cuenta de servicio)
define('GOOGLE_DRIVE_FOLDER_ID', '');
