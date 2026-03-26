# Control de Horarios — Cuidadores

Aplicación web para registrar las horas de trabajo de cuidadores. Permite fichar entrada y salida, consultar el historial de registros y agregar entradas históricas. Todos los datos se almacenan en una hoja de cálculo de Google Sheets.

## Requisitos previos

- Node.js 18 o superior
- Una cuenta de Google Cloud con la API de Google Sheets habilitada
- Una cuenta de servicio con clave JSON descargada

## Configuración de Google Sheets

1. Crea una hoja de cálculo en Google Sheets con dos pestañas:

   - **Cuidadores** — Columna A con los nombres de los cuidadores
   - **Registro** — Columnas: A (Fecha-Hora Entrada), B (Fecha-Hora Salida), C (Nombre), D (Tiempo Total)

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
# Desarrollo
npm run dev

# Producción
npm run build
npm run start
```

La aplicación estará disponible en `http://localhost:3000`.

## Uso

1. Selecciona un cuidador de la lista
2. Presiona **Entrada** para fichar la hora de llegada
3. Presiona **Salida** para fichar la hora de salida (si el turno supera 8 horas, se pedirá confirmación)
4. Si otro cuidador ya está fichado, puedes agregar un registro histórico con fechas y horas personalizadas
5. Consulta el historial en la pestaña **Historial**, con filtro por cuidador y totales de horas
