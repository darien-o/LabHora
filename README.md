# Control de Horarios — Cuidadores

Aplicación web para registrar las horas de trabajo de cuidadores. Permite fichar entrada y salida, consultar el historial de registros y agregar entradas históricas. Todos los datos se almacenan en una hoja de cálculo de Google Sheets.

## Requisitos previos

- Node.js 18 o superior
- Una cuenta de Google Cloud con la API de Google Sheets habilitada
- Una cuenta de servicio con clave JSON descargada

## Configuración de Google Sheets

1. Crea una hoja de cálculo en Google Sheets con dos pestañas:

   - **Cuidadores** — Columna A con los nombres de los cuidadores
   - **Registro** — Columnas: A (Fecha-Hora Entrada), B (Fecha-Hora Salida), C (Nombre), D (Tiempo Total), E (Pagado)

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

La app se exporta como sitio estático + un backend PHP mínimo que hace de proxy a Google Sheets.

### 1. Generar el sitio estático

```bash
npm run build
```

Esto genera la carpeta `out/` con todos los archivos HTML/CSS/JS.

### 2. Preparar el backend PHP

```bash
cd php-api
composer install
```

### 3. Configurar credenciales

Edita `php-api/config.php` con tus credenciales de Google:
- `GOOGLE_SHEET_ID` — ID de tu hoja de cálculo
- `GOOGLE_CLIENT_EMAIL` — Email de la cuenta de servicio
- `GOOGLE_PRIVATE_KEY` — Clave privada del JSON descargado
- `ALLOWED_ORIGIN` — Cambia `*` por tu dominio en producción

### 4. Subir archivos a Hostinger

Estructura en `public_html/`:

```
public_html/
├── .htaccess          ← copiar de hosting/.htaccess
├── index.html         ← desde out/
├── _next/             ← desde out/_next/
├── placeholder.svg    ← desde out/ (assets estáticos)
├── ...                ← demás archivos de out/
└── php-api/
    ├── .htaccess
    ├── config.php
    ├── sheets.php
    ├── people.php
    ├── time-entries.php
    ├── clock-in.php
    ├── clock-out.php
    ├── historical-entry.php
    ├── toggle-paid.php
    └── vendor/        ← generado por composer install
```

### 5. Verificar

- Accede a `https://tudominio.com` — debería cargar la app
- Accede a `https://tudominio.com/php-api/people.php` — debería devolver JSON con los cuidadores

## Uso

1. Selecciona un cuidador de la lista
2. Presiona **Entrada** para fichar la hora de llegada
3. Presiona **Salida** para fichar la hora de salida (si el turno supera 8 horas, se pedirá confirmación)
4. Si otro cuidador ya está fichado, puedes agregar un registro histórico con fechas y horas personalizadas
5. Consulta el historial en la pestaña **Historial**, con filtro por cuidador y totales de horas
