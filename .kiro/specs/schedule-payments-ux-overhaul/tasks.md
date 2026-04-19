# Plan de Implementación: Rediseño de Programación, Pagos y UX

## Visión General

Este plan implementa las mejoras integrales de Marujita Horas en tres áreas: programación de turnos (selección de día, multi-día, alertas, repetitivos, bloqueos), mejoras de UI/UX (botones, lote, historial, semana lunes), y funcionalidades de pagos (marcado masivo, recibos, anticipos, alertas con edición, gastos extra, confirmación de pagos). Toda la data proviene de Google Sheets vía php-api — sin datos mockeados.

## Tareas

- [ ] 1. Configurar estructura base, nuevas hojas y utilidades de programación
  - [x] 1.1 Actualizar `php-api/config.example.php` con las nuevas constantes de hojas
    - Agregar `SHEET_ANTICIPOS`, `SHEET_GASTOS`, `SHEET_RECIBOS`, `SHEET_BLOQUEOS` a `config.example.php` y `config.php`
    - Actualizar el rango de lectura de `SHEET_REGISTRO` para incluir columnas G–K (Notas, Imágenes, Confirmado Cuidador, Fecha Confirmación, Monto Confirmado)
    - _Requisitos: 2.1, 5.1, 11.4, 12.2, 13.2, 15.2_

  - [x] 1.2 Crear `lib/schedule-utils.ts` con funciones de lógica de programación
    - Implementar `generateMultiDayRecords(config: MultiDayConfig)` — genera registros individuales por día (primer día: startTime→23:59, intermedios: 00:00→23:59, último: 00:00→endTime)
    - Implementar `generateRepeatInstances(startDate, endDate, frequency, startTime, endTime)` — genera instancias de turno repetitivo según frecuencia diaria/semanal
    - Implementar `checkBlockConflicts(personName, date, startTime, endTime, blocks)` — detecta conflictos con bloqueos activos
    - Implementar `getWeekStartMonday(date: Date): Date` — retorna el lunes de la semana
    - Implementar `getNextCalendarDay(date: string): string` — retorna el siguiente día calendario sin saltar fines de semana
    - _Requisitos: 1.4, 2.2, 4.2, 5.2, 7.3, 10.1_

  - [x] 1.3 Crear `lib/settlement-utils.ts` con funciones de liquidación
    - Implementar `calculateSettlement(entries, advances, expenses, hourlyRate)` — calcula: (horas × tarifa) + gastos_extra − dinero_recibido − anticipos
    - _Requisitos: 13.3, 15.4_

  - [x] 1.4 Crear `lib/shift-alerts.ts` con funciones de alertas de turno
    - Implementar `shouldShowUpcomingAlert(shiftDate, shiftStartTime, currentTime)` — retorna true si el turno está a ≤30 minutos de su inicio
    - Implementar `shouldGenerateNoShowAlert(shiftDate, shiftStartTime, currentTime, confirmed)` — retorna true si pasaron >60 minutos sin confirmación
    - _Requisitos: 3.1, 3.5_

  - [ ] 1.5 Escribir tests de propiedades para `generateMultiDayRecords`
    - **Propiedad 1: Registro multi-día genera registros individuales correctos**
    - **Valida: Requisito 2.2**

  - [ ]* 1.6 Escribir tests de propiedades para `shouldShowUpcomingAlert`
    - **Propiedad 3: Notificación de turno próximo respeta umbral de 30 minutos**
    - **Valida: Requisito 3.1**

  - [ ]* 1.7 Escribir tests de propiedades para `shouldGenerateNoShowAlert`
    - **Propiedad 4: Alerta de no-show después de 60 minutos**
    - **Valida: Requisito 3.5**

  - [ ]* 1.8 Escribir tests de propiedades para `generateRepeatInstances`
    - **Propiedad 5: Turno repetitivo genera todas las instancias correctas**
    - **Valida: Requisito 4.2**

  - [ ]* 1.9 Escribir tests de propiedades para `getNextCalendarDay`
    - **Propiedad 9: Avance de fecha incluye todos los días de la semana**
    - **Valida: Requisitos 7.3, 7.4**

  - [ ]* 1.10 Escribir tests de propiedades para `getWeekStartMonday` y navegación semanal
    - **Propiedad 10: Semana inicia en lunes y navegación es correcta**
    - **Valida: Requisitos 10.1, 10.3, 10.4**

  - [ ]* 1.11 Escribir tests de propiedades para `checkBlockConflicts`
    - **Propiedad 8: Bloqueo impide y desbloqueo permite creación de turnos (round-trip)**
    - **Valida: Requisitos 5.2, 5.5**

  - [ ]* 1.12 Escribir tests de propiedades para `calculateSettlement`
    - **Propiedad 13: Cálculo de liquidación con anticipos, gastos e ingresos**
    - **Valida: Requisitos 13.3, 15.4**

- [x] 2. Checkpoint — Verificar que todas las utilidades y tests pasan
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 3. Implementar endpoints PHP nuevos
  - [x] 3.1 Crear `php-api/anticipos.php` — CRUD de anticipos
    - GET: leer todos los anticipos de la hoja "Anticipos", con filtro opcional por mes (`?month=YYYY-MM`)
    - POST action="add": agregar anticipo (cuidador, monto, fecha, mes, descripción)
    - POST action="edit": editar anticipo existente por rowIndex
    - POST action="delete": eliminar anticipo por rowIndex (limpiar fila)
    - Validar anticipo duplicado (mismo cuidador, misma fecha) → error 400
    - _Requisitos: 13.1, 13.2_

  - [x] 3.2 Crear `php-api/gastos.php` — CRUD de gastos extra y dinero recibido
    - GET: leer todos los gastos de la hoja "Gastos", con filtro opcional por registro asociado (`?entryRowIndex=N`)
    - POST action="add": agregar gasto/ingreso (cuidador, tipo gasto/ingreso, monto, descripción, registro asociado)
    - POST action="delete": eliminar gasto por rowIndex
    - _Requisitos: 15.2, 15.3_

  - [x] 3.3 Crear `php-api/recibos.php` — CRUD de recibos de pago con imagen
    - GET: leer recibos de la hoja "Recibos", con filtro opcional por mes
    - POST: crear recibo con notas, descripción e imagen (multipart/form-data); subir imagen a Google Drive y guardar fileId/URL en la hoja
    - _Requisitos: 12.1, 12.2_

  - [x] 3.4 Crear `php-api/bloqueos.php` — CRUD de bloqueos de horario
    - GET: leer bloqueos de la hoja "Bloqueos", con filtro opcional por semana (`?weekStart=YYYY-MM-DD`)
    - POST action="add": agregar bloqueo (cuidador, fecha inicio, fecha fin, hora inicio/fin opcionales, repetir, motivo)
    - POST action="remove": eliminar bloqueo por rowIndex
    - _Requisitos: 5.1, 5.5_

  - [x] 3.5 Crear `php-api/confirm-payment.php` — Confirmación de pago por cuidador
    - POST: registrar confirmación de pago en columnas I–K de la hoja "Registro" (Confirmado Cuidador="Sí", Fecha Confirmación, Monto Confirmado)
    - Recibir rowIndex y opcionalmente amountReceived
    - _Requisitos: 12.4, 16.2_

- [x] 4. Modificar endpoints PHP existentes
  - [x] 4.1 Modificar `php-api/schedule.php` para soportar turnos repetitivos y validación contra bloqueos
    - Agregar acción "add-repeat": recibir configuración de repetición (frequency, endDate) y crear múltiples instancias
    - Antes de agregar cualquier turno, verificar contra la hoja "Bloqueos" si el cuidador tiene un bloqueo activo en esa fecha/hora → error 400 con mensaje explicativo
    - Retornar lista de fechas con conflicto si el turno repetitivo genera solapamientos
    - _Requisitos: 4.2, 4.4, 5.2_

  - [x] 4.2 Modificar `php-api/toggle-paid.php` para soportar marcado masivo
    - Agregar acción "bulk-toggle": recibir array de rowIndices y estado paid, actualizar todos en una operación
    - Opcionalmente asociar un recibo al marcado masivo
    - _Requisitos: 11.4, 12.2_

  - [x] 4.3 Modificar `php-api/time-entries.php` para leer columnas adicionales
    - Ampliar rango de lectura de `A:F` a `A:K` para incluir Notas (G), Imágenes (H), Confirmado Cuidador (I), Fecha Confirmación (J), Monto Confirmado (K)
    - Incluir los nuevos campos en la respuesta JSON de cada entrada
    - _Requisitos: 9.1, 9.2, 16.5_

- [x] 5. Extender el API client del frontend
  - [x] 5.1 Agregar funciones al `lib/api-client.ts` para los nuevos endpoints
    - `fetchAdvances(month?)`, `postAdvance(data)` — anticipos
    - `fetchExpenses(entryRowIndex?)`, `postExpense(data)` — gastos
    - `fetchReceipts(month?)`, `postReceipt(formData)` — recibos (multipart)
    - `fetchBlocks(weekStart?)`, `postBlock(data)` — bloqueos
    - `postPaymentConfirmation(entryRowIndex, amountReceived?)` — confirmación de pago
    - `postBulkTogglePaid(rowIndices, paid)` — marcado masivo
    - `postScheduleRepeat(data)` — turno repetitivo
    - _Requisitos: 4.2, 5.1, 11.4, 12.2, 13.2, 15.2, 16.2_

- [x] 6. Checkpoint — Verificar endpoints PHP y API client
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 7. Rediseño global de botones y componente UI base
  - [x] 7.1 Modificar `components/ui/button.tsx` para agregar variante de acción con estilo píldora
    - Agregar variante `action` con border-radius completo (rounded-full), gradientes de color y sombra sutil
    - Mantener área táctil mínima de 44x44px (ya existe en globals.css)
    - Agregar efecto de retroalimentación visual al presionar (active:scale, cambio de gradiente)
    - Limitar ancho por defecto de botones de acción (max-w-xs o similar), excepto cuando se use `className` para ancho completo
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Implementar componentes de programación de turnos
  - [x] 8.1 Crear `components/shift-day-picker.tsx` — Selector de día con paso intermedio
    - Mostrar días de la semana como botones individuales con nombre del día y fecha correspondiente
    - Resaltar visualmente el día seleccionado
    - Tras seleccionar día, mostrar tres opciones: "Día Completo (00:00–23:59)", "Turno Laboral" (Mañana/Tarde/Noche), "Horario Personalizado"
    - Día Completo crea turno 00:00–23:59; Turno Laboral muestra opciones predefinidas existentes; Personalizado muestra campos de hora
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 8.2 Crear `components/multi-day-registration.tsx` — Formulario de registro multi-día
    - Permitir seleccionar fecha de inicio y fecha de fin para rango multi-día
    - Usar `generateMultiDayRecords` para generar registros individuales
    - Mostrar resumen antes de confirmar (días, horas totales)
    - Al confirmar, generar alerta administrativa con nombre del cuidador, fechas y total de horas
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

  - [x] 8.3 Crear `components/upcoming-shift-alert.tsx` — Banner de alerta de turno próximo
    - Usar `shouldShowUpcomingAlert` para determinar cuándo mostrar
    - Mostrar notificación visual prominente con botón "Confirmar turno"
    - Al confirmar, registrar clock-in automático a la hora de inicio programada
    - Si el turno ya comenzó y no se confirmó, mantener alerta con indicación
    - Si pasan >60 minutos sin confirmación, generar alerta administrativa de no-show
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 8.4 Crear `components/repeat-shift-config.tsx` — Configuración de turnos repetitivos
    - Ofrecer selección de frecuencia (diaria, semanal) y fecha de fin del período
    - Usar `generateRepeatInstances` para generar instancias
    - Detectar conflictos con turnos existentes y mostrar diálogo con fechas conflictivas
    - Permitir omitir fechas con conflicto o cancelar la operación
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 8.5 Escribir tests de propiedades para eliminación de instancia individual de turno repetitivo
    - **Propiedad 6: Eliminación de instancia individual no afecta otras**
    - **Valida: Requisito 4.3**

  - [ ]* 8.6 Escribir tests de propiedades para detección de conflictos en turnos repetitivos
    - **Propiedad 7: Detección de conflictos en turnos repetitivos**
    - **Valida: Requisito 4.4**

  - [x] 8.7 Crear `components/block-schedule-dialog.tsx` — Diálogo de bloqueo de horarios
    - Permitir seleccionar cuidador, fecha inicio, fecha fin, rango horario opcional
    - Ofrecer opción de repetición semanal con fecha de fin
    - Usar `postBlock` del API client para guardar en hoja "Bloqueos"
    - _Requisitos: 5.1, 5.3, 5.5_

- [ ] 9. Modificar `components/schedule-view.tsx` — Vista semanal mejorada
  - [x] 9.1 Cambiar semana para que inicie en lunes en lugar de domingo
    - Reemplazar `getWeekStart` para usar `getWeekStartMonday` de `lib/schedule-utils.ts`
    - Actualizar `DAY_NAMES_FULL` para que el orden sea Lunes→Domingo
    - Mostrar rango de fechas lunes–domingo
    - _Requisitos: 10.1, 10.4_

  - [x] 9.2 Mejorar botones de navegación semanal
    - Aplicar estilo de botón con borde, fondo con contraste y tamaño adecuado para interacción táctil
    - _Requisitos: 10.2, 10.3_

  - [x] 9.3 Integrar `ShiftDayPicker` como nuevo flujo de asignación de turno
    - Reemplazar el diálogo actual de agregar turno con el nuevo flujo de paso intermedio
    - _Requisitos: 1.1, 1.2, 1.3_

  - [x] 9.4 Integrar soporte para turnos repetitivos con `RepeatShiftConfig`
    - Agregar opción de "Hacer repetitivo" al crear un turno
    - _Requisitos: 4.1, 4.2_

  - [x] 9.5 Integrar bloqueos de horario en la vista semanal
    - Cargar bloqueos con `fetchBlocks` y mostrar indicación visual en días bloqueados
    - Impedir creación de turnos en fechas/horas bloqueadas con mensaje explicativo
    - Agregar botón para crear bloqueo (solo admin) que abre `BlockScheduleDialog`
    - _Requisitos: 5.2, 5.4, 5.5_

- [x] 10. Checkpoint — Verificar programación de turnos completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [ ] 11. Implementar mejoras de UI/UX en historial y registro por lote
  - [x] 11.1 Modificar `components/batch-historical-dialog.tsx` — Mejoras en registro por lote
    - Reemplazar selector de cuidador (Select/dropdown) por cuadrícula de iconos/avatares con nombre debajo
    - Preseleccionar al cuidador correspondiente al perfil de la sesión activa
    - Cambiar avance de fecha para incluir sábados y domingos (usar `getNextCalendarDay` en lugar de saltar fines de semana)
    - Resaltar visualmente el cuidador seleccionado con borde de color e indicador de selección
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 11.2 Crear `components/collapsible-filters.tsx` — Filtros colapsables para historial
    - Ocultar filtros por defecto al cargar la vista
    - Mostrar botón claramente identificable para expandir/colapsar
    - Animación suave al expandir/colapsar
    - _Requisitos: 8.2, 8.3_

  - [x] 11.3 Crear `components/image-viewer-modal.tsx` — Visor modal de imágenes
    - Mostrar imágenes en modal con navegación entre ellas (anterior/siguiente)
    - Recibir array de URLs de imágenes
    - _Requisitos: 9.3_

  - [x] 11.4 Modificar `components/history-view.tsx` — Simplificación y nuevas funcionalidades
    - Cambiar título "Historial de Registros" con color diferenciado y mayor peso visual
    - Integrar `CollapsibleFilters` para ocultar filtros por defecto
    - Mejorar botones de navegación de meses con mayor contraste, tamaño y estilo
    - Reducir espaciado y sobrecarga visual
    - Mostrar notas debajo de la información de horas en cada tarjeta de registro
    - Mostrar indicador con número de imágenes adjuntas; al presionar, abrir `ImageViewerModal`
    - Si un registro no tiene notas ni imágenes, no mostrar secciones adicionales
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 11.5 Escribir tests de propiedades para notas e imágenes en historial
    - **Propiedad 11: Notas e imágenes se muestran cuando están presentes**
    - **Valida: Requisitos 9.1, 9.2**

- [ ] 12. Implementar funcionalidades de pagos — Marcado masivo
  - [x] 12.1 Crear `components/bulk-payment-bar.tsx` — Barra flotante de marcado masivo
    - Mostrar casillas de verificación junto a cada registro no pagado cuando el modo de selección está activo
    - Mostrar botón flotante/fijo con conteo de registros seleccionados y acción "Marcar seleccionados como pagados"
    - Ofrecer botón "Marcar todo el mes como pagado" cuando se filtra por mes
    - _Requisitos: 11.1, 11.2, 11.3, 11.5_

  - [x] 12.2 Integrar modo de selección múltiple en `components/history-view.tsx`
    - Agregar toggle para activar/desactivar modo de selección múltiple (solo admin)
    - Integrar `BulkPaymentBar` con la lógica de selección
    - Al confirmar marcado masivo, llamar a `postBulkTogglePaid` y actualizar estado local
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 12.3 Escribir tests de propiedades para selección masiva y marcado
    - **Propiedad 12: Selección masiva y acción de marcado**
    - **Valida: Requisitos 11.3, 11.4**

- [ ] 13. Implementar funcionalidades de pagos — Recibos, anticipos y confirmación
  - [x] 13.1 Crear `components/payment-receipt-dialog.tsx` — Diálogo de recibo de pago
    - Formulario con campos para notas, descripción e imagen adjunta
    - Subir imagen usando `postReceipt` (multipart/form-data)
    - Mostrar al marcar registros como pagados
    - _Requisitos: 12.1, 12.2_

  - [x] 13.2 Crear `components/advance-payment-dialog.tsx` — Formulario de anticipos
    - Campos: cuidador, monto, fecha, descripción opcional
    - Validar monto > 0
    - Guardar con `postAdvance`
    - _Requisitos: 13.1, 13.2_

  - [x] 13.3 Crear `components/payment-confirmation.tsx` — Confirmación de pago por cuidador
    - Mostrar botón de confirmación en cada registro marcado como pagado
    - Permitir al cuidador indicar monto recibido (campo opcional)
    - Mostrar indicador "Pendiente de confirmación" si el admin marcó como pagado pero el cuidador no confirmó
    - Ofrecer opción de aprobar pago para todo el mes o registros específicos
    - _Requisitos: 12.3, 12.4, 12.5, 16.1, 16.2, 16.5_

  - [x] 13.4 Integrar anticipos y confirmaciones en `components/history-view.tsx`
    - Mostrar anticipos como entradas diferenciadas en la lista de historial (fecha, monto, descripción)
    - Mostrar botón para confirmar anticipo recibido correctamente
    - Mostrar actividad de pagos realizados como entradas diferenciadas
    - _Requisitos: 13.4, 13.5, 16.3, 16.4_

  - [ ]* 13.5 Escribir tests de propiedades para historial con entradas diferenciadas
    - **Propiedad 14: Historial muestra entradas diferenciadas con indicadores de estado**
    - **Valida: Requisitos 13.4, 15.5, 16.3, 16.5**

- [x] 14. Checkpoint — Verificar funcionalidades de pagos
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [ ] 15. Implementar gastos extra y alertas con edición
  - [x] 15.1 Crear `components/active-shift-expenses.tsx` — Panel de gastos durante turno activo
    - Mostrar opciones para registrar gastos extra y dinero recibido cuando hay turno activo
    - Formulario con descripción y monto para cada tipo
    - Guardar con `postExpense` asociado al turno activo
    - Mostrar resumen de gastos y dinero recibido del turno actual
    - _Requisitos: 15.1, 15.2, 15.3, 15.5_

  - [x] 15.2 Integrar `ActiveShiftExpenses` en la página principal (`app/page.tsx`)
    - Mostrar panel de gastos cuando el cuidador tiene un turno activo, debajo del botón de salida
    - _Requisitos: 15.1_

  - [x] 15.3 Integrar gastos en la liquidación de `components/history-view.tsx`
    - Cargar gastos con `fetchExpenses` y mostrar asociados a cada registro
    - Mostrar resumen de gastos y dinero recibido en la sección de liquidación
    - Usar `calculateSettlement` para el cálculo neto
    - _Requisitos: 15.4, 15.5, 15.6_

  - [x] 15.4 Crear `components/alert-detail-panel.tsx` — Panel de detalle de alerta con edición
    - Al hacer clic en una alerta, mostrar panel con información completa y opciones de acción
    - Para alertas de inconsistencia: ofrecer edición directa del registro de tiempo
    - Para alertas de cruce: ofrecer aprobar cruce o editar registros involucrados
    - Al editar registro desde alerta, actualizar en Google Sheets y marcar alerta como resuelta automáticamente
    - Al aprobar inconsistencia, marcar como resuelta y registrar aprobación
    - _Requisitos: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 15.5 Modificar `components/admin-alerts-panel.tsx` para integrar `AlertDetailPanel`
    - Reemplazar la acción simple de "resolver" por apertura del panel de detalle al hacer clic
    - Extender tipos de alerta para incluir "no-show" y "multi-day"
    - _Requisitos: 14.1, 14.2, 14.3_

  - [ ]* 15.6 Escribir tests de propiedades para edición desde alerta
    - **Propiedad 15: Edición desde alerta resuelve la alerta**
    - **Valida: Requisito 14.4**

- [ ] 16. Integrar alerta de turno próximo y registro multi-día en la página principal
  - [x] 16.1 Integrar `UpcomingShiftAlert` en `app/page.tsx`
    - Cargar turnos programados del día actual con `fetchSchedule`
    - Usar `shouldShowUpcomingAlert` para determinar si mostrar el banner
    - Mostrar banner prominente con botón de confirmación
    - _Requisitos: 3.1, 3.2, 3.3, 3.4_

  - [x] 16.2 Integrar `MultiDayRegistration` en la vista de programación o como opción en el registro
    - Agregar botón/opción para "Registro Multi-Día" accesible desde la vista de programación
    - _Requisitos: 2.1, 2.2_

  - [x] 16.3 Extender `AdminContext` (`lib/admin-context.tsx`) con nuevos tipos de alerta
    - Agregar tipos "no-show" y "multi-day" a la interfaz `AdminAlert`
    - Agregar campo `entryRowIndex` opcional para edición directa
    - Agregar campos `approvedBy` y `approvalDate` para registro de aprobaciones
    - _Requisitos: 2.3, 3.5, 14.4, 14.5_

  - [x] 16.4 Actualizar interfaces TypeScript en los componentes existentes
    - Agregar campos `notes`, `images`, `confirmedByCaregiver`, `confirmationDate`, `amountConfirmed` a la interfaz `TimeEntry` en `app/page.tsx` y `components/history-view.tsx`
    - _Requisitos: 9.1, 16.5_

- [ ] 17. Aplicar estilo de botones rediseñados en todas las vistas
  - [x] 17.1 Actualizar botones de acción en todas las vistas para usar la nueva variante
    - Aplicar estilo píldora con gradientes a botones principales en: Registrar (Marcar Entrada/Salida), Programar (Agregar turno, navegación), Historial (filtros, acciones), Admin (acciones de panel)
    - Mantener botón principal de Marcar Entrada/Salida a ancho completo como excepción
    - Verificar consistencia visual en todas las vistas
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 18. Checkpoint final — Verificar integración completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades validan propiedades universales de correctitud usando fast-check
- Los tests unitarios validan ejemplos específicos y casos borde
- **Importante**: El usuario debe crear manualmente 4 nuevas hojas en Google Sheets (Anticipos, Gastos, Recibos, Bloqueos) y agregar 5 columnas nuevas (G–K) a la hoja "Registro" existente antes de probar los endpoints
- Toda la data proviene del backend Google Sheets vía php-api — no se deben dejar datos mockeados en la implementación
