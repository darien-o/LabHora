# Control de Horarios — Cuidadores

Aplicación web para registrar las horas de trabajo de cuidadores. Permite fichar entrada y salida, consultar el historial de registros y agregar entradas históricas. Todos los datos se almacenan en una hoja de cálculo de Google Sheets.

## Requisitos previos

- Node.js 18 o superior
- Una cuenta de Google Cloud con la API de Google Sheets habilitada
- Una cuenta de servicio con clave JSON descargada

## Configuración de Google Sheets

1. Crea una hoja de cálculo en Google Sheets con tres pestañas:

   - **Cuidadores** — Columna A con los nombres de los cuidadores
   - **Registro** — Columnas: A (Fecha-Hora Entrada), B (Fecha-Hora Salida), C (Nombre), D (Tiempo Total), E (Pagado)
   - **Turnos** — Columnas: A (Fecha YYYY-MM-DD), B (Nombre), C (Hora Inicio HH:mm), D (Hora Fin HH:mm)

2. Comparte la hoja con el email de la cuenta de servicio (permisos de editor).

## Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```
GOOGLE_SHEET_ID=tu_id_de_hoja_de_calculo
GOOGLE_CLIENT_EMAIL=tu_email@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_clave_privada\n-----END PRIVATE KEY-----\n"
```

El ID de la hoja se encuentra en la URL de Google Sheets:
`https://docs.google.com/spreadsheets/d/{ESTE_ES_EL_ID}/edit`

## Instalación

```bash
npm install
```

## Ejecución

```bash
# Desarrollo (con Next.js API routes)
npm run dev

# Generar sitio estático para hosting
npm run build
# Los archivos estáticos quedan en la carpeta out/
```

La aplicación estará disponible en `http://localhost:3000`.

## Despliegue en Shared Hosting (Hostinger)

La app se exporta como sitio estático + un backend PHP mínimo. GitHub Actions se encarga de hacer el build y subir solo los archivos necesarios a Hostinger via SFTP.

### Configuración inicial (una sola vez)

#### 1. Secrets en GitHub

Ve a tu repo → Settings → Secrets and variables → Actions, y agrega:

| Secret | Valor |
|--------|-------|
| `FTP_HOST` | Tu servidor FTP de Hostinger (ej: `ftp.tudominio.com`) |
| `FTP_USER` | Tu usuario FTP |
| `FTP_PASS` | Tu contraseña FTP |

Los datos FTP los encuentras en Hostinger → Archivos → Cuentas FTP.

#### 2. Credenciales de Google en el servidor

Vía SSH o File Manager de Hostinger:
1. Crea `public_html/php-api/config.php` copiando el contenido de `config.example.php`
2. Completa tus credenciales de Google
3. Cambia `ALLOWED_ORIGIN` a tu dominio

Este archivo nunca se sobreescribe en el deploy (se excluye del build).

### Desplegar

Solo haz push a `main`:

```bash
git push origin main
```

GitHub Actions automáticamente:
1. Hace `npm run build` (genera `out/`)
2. Hace `composer install` (solo Google Sheets API)
3. Sube `out/*` + `php-api/` a `public_html/` via SFTP

### Estructura resultante en public_html/

```
public_html/
├── .htaccess              ← redirige al contenido de out/
├── index.html             ← página principal
├── _next/                 ← assets JS/CSS
├── php-api/
│   ├── .htaccess          ← protege config.php y vendor/
│   ├── config.php         ← credenciales (creado manualmente, no en git)
│   ├── sheets.php
│   ├── people.php
│   ├── time-entries.php
│   ├── clock-in.php
│   ├── clock-out.php
│   ├── historical-entry.php
│   ├── toggle-paid.php
│   └── vendor/
└── ...
```

## Uso

1. Selecciona un cuidador de la lista
2. Presiona **Entrada** para fichar la hora de llegada
3. Presiona **Salida** para fichar la hora de salida (si el turno supera 8 horas, se pedirá confirmación)
4. Si otro cuidador ya está fichado, puedes agregar un registro histórico con fechas y horas personalizadas
5. Consulta el historial en la pestaña **Historial**, con filtro por cuidador y totales de horas
6. En la pestaña **Turnos**, asigna bloques de 2 horas (6AM–10PM) a cada cuidador para la semana. Navega entre semanas y visualiza la cobertura
