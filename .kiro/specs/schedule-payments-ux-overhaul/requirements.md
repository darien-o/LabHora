# Documento de Requisitos — Rediseño de Programación, Pagos y UX

## Introducción

Este documento define los requisitos para una mejora integral de la aplicación Marujita Horas, un sistema de seguimiento de tiempo para cuidadores. Los cambios abarcan tres áreas principales: (1) mejoras en la programación de turnos, incluyendo selección de día, turnos de día completo, registro multi-día continuo, alertas de turno próximo, turnos repetitivos y bloqueo de horarios; (2) mejoras de UI/UX globales, incluyendo rediseño de botones, mejoras en el registro histórico por lote, simplificación de la vista de historial, y ajustes en la vista semanal de turnos; (3) funcionalidades administrativas de pagos, incluyendo marcado masivo de pagos, recibos de pago con imágenes, anticipos, gestión de alertas con edición, gastos extra en turnos activos, y confirmación de pagos por parte del cuidador. El backend utiliza Google Sheets a través de una API PHP.

## Glosario

- **Sistema_Turnos**: Módulo de la aplicación responsable de la programación, visualización y gestión de turnos de cuidadores (componente `ScheduleView` y endpoint `schedule.php`).
- **Sistema_Pagos**: Módulo de la aplicación responsable de la gestión de pagos, liquidaciones, anticipos y recibos (componentes `HistoryView`, `AdminRecaudos` y endpoints `toggle-paid.php`, `recaudos.php`).
- **Sistema_Historial**: Módulo de la aplicación responsable de la visualización y gestión de registros históricos de tiempo (componente `HistoryView` y endpoint `time-entries.php`).
- **Sistema_Registro_Lote**: Módulo de la aplicación responsable del registro histórico masivo de entradas de tiempo (componente `BatchHistoricalDialog` y endpoint `historical-entry.php`).
- **Sistema_Alertas**: Módulo de la aplicación responsable de generar, mostrar y gestionar alertas administrativas (componente `AdminAlertsPanel` y contexto `AdminContext`).
- **Sistema_UI**: Capa de presentación global de la aplicación, incluyendo todos los componentes de interfaz de usuario (componentes en `components/ui/`).
- **Administrador**: Usuario con permisos elevados que gestiona pagos, recaudos, alertas y puede editar cualquier registro.
- **Cuidador**: Usuario regular de la aplicación que registra sus horas de trabajo y visualiza su historial.
- **Turno_Completo**: Turno que cubre un día completo, definido como 00:00 a 23:59.
- **Turno_Laboral**: Turno predefinido con horarios estándar (Mañana, Tarde, Noche) tal como existe actualmente en la aplicación.
- **Turno_Personalizado**: Turno con horas de inicio y fin definidas manualmente por el usuario.
- **Registro_Multi_Día**: Registro de trabajo continuo que abarca más de un día calendario consecutivo.
- **Turno_Repetitivo**: Turno programado que se repite automáticamente durante un período de tiempo definido.
- **Bloqueo_Horario**: Restricción que impide la asignación de turnos a un cuidador específico durante un período determinado.
- **Anticipo**: Pago adelantado realizado a un cuidador sin asociarlo a una actividad o registro específico.
- **Recibo_Pago**: Documento digital que incluye notas, descripción e imagen como comprobante de un pago realizado.
- **Gasto_Extra**: Gasto adicional registrado durante un turno activo (transporte, alimentación, etc.).
- **Liquidación**: Proceso de cálculo y cierre de pagos para un período determinado.
- **Google_Sheets_Backend**: Sistema de almacenamiento de datos basado en Google Sheets, accedido mediante la API PHP (`php-api/`).

## Requisitos

### Requisito 1: Selección mejorada de día de la semana al asignar turno

**User Story:** Como cuidador, quiero seleccionar el día de la semana de forma más clara y con pasos adicionales al asignar un turno, para que el proceso sea más intuitivo y reduzca errores.

#### Criterios de Aceptación

1. WHEN el Cuidador inicia la asignación de un turno, THE Sistema_Turnos SHALL presentar un paso intermedio que muestre los días de la semana como botones individuales claramente etiquetados con el nombre del día y la fecha correspondiente.
2. WHEN el Cuidador selecciona un día de la semana, THE Sistema_Turnos SHALL resaltar visualmente el día seleccionado y habilitar el paso siguiente de selección de horario.
3. WHEN el Cuidador ha seleccionado un día, THE Sistema_Turnos SHALL mostrar tres opciones claramente diferenciadas: "Día Completo (00:00 – 23:59)", "Turno Laboral" (opciones predefinidas actuales), y "Horario Personalizado".
4. WHEN el Cuidador selecciona "Día Completo", THE Sistema_Turnos SHALL crear un turno con hora de inicio 00:00 y hora de fin 23:59 para el día seleccionado.
5. WHEN el Cuidador selecciona "Turno Laboral", THE Sistema_Turnos SHALL mostrar las opciones predefinidas existentes (Mañana, Tarde, Noche).
6. WHEN el Cuidador selecciona "Horario Personalizado", THE Sistema_Turnos SHALL mostrar campos de hora de inicio y hora de fin para que el Cuidador defina el rango manualmente.

---

### Requisito 2: Registro continuo multi-día

**User Story:** Como cuidador, quiero registrar turnos continuos de varios días consecutivos (por ejemplo, 3 días seguidos), para que mi tiempo de trabajo se refleje correctamente sin tener que crear múltiples registros individuales.

#### Criterios de Aceptación

1. WHEN el Cuidador selecciona la opción de registro multi-día, THE Sistema_Turnos SHALL permitir seleccionar una fecha de inicio y una fecha de fin que abarque múltiples días consecutivos.
2. WHEN el Cuidador confirma un registro multi-día, THE Sistema_Turnos SHALL crear registros individuales por cada día del rango, respetando las horas de inicio del primer día y las horas de fin del último día.
3. WHEN un registro multi-día es confirmado, THE Sistema_Alertas SHALL generar una alerta administrativa indicando el nombre del cuidador, las fechas del rango y la cantidad total de horas.
4. WHEN el Administrador visualiza la alerta de registro multi-día, THE Sistema_Alertas SHALL mostrar un resumen con el cuidador, las fechas y el total de horas registradas.

---

### Requisito 3: Alerta de turno próximo y confirmación de asistencia

**User Story:** Como cuidador, quiero recibir una alerta cuando se acerca la hora de un turno programado, para que pueda confirmar que tomaré el turno sin tener que navegar a múltiples secciones de la aplicación.

#### Criterios de Aceptación

1. WHILE un turno programado está a 30 minutos o menos de su hora de inicio, THE Sistema_Turnos SHALL mostrar una notificación visual prominente al Cuidador asignado indicando el turno próximo.
2. WHEN el Cuidador visualiza la alerta de turno próximo, THE Sistema_Turnos SHALL ofrecer un botón para confirmar que tomará el turno.
3. WHEN el Cuidador confirma que tomará el turno, THE Sistema_Turnos SHALL registrar automáticamente la entrada (clock-in) del Cuidador a la hora de inicio programada del turno.
4. WHILE un turno programado ha alcanzado su hora de inicio y el Cuidador no ha confirmado, THE Sistema_Turnos SHALL mantener la alerta visible con indicación de que el turno ya comenzó.
5. IF el Cuidador no confirma el turno dentro de los 60 minutos posteriores a la hora de inicio, THEN THE Sistema_Alertas SHALL generar una alerta administrativa indicando que el cuidador no se presentó al turno programado.

---

### Requisito 4: Turnos repetitivos

**User Story:** Como cuidador, quiero programar turnos que se repitan automáticamente durante un período de tiempo, para no tener que crear cada turno individualmente cada semana.

#### Criterios de Aceptación

1. WHEN el Cuidador crea un turno, THE Sistema_Turnos SHALL ofrecer la opción de hacerlo repetitivo con selección de frecuencia (diaria, semanal) y fecha de fin del período de repetición.
2. WHEN el Cuidador confirma un turno repetitivo, THE Sistema_Turnos SHALL crear todas las instancias del turno en el Google_Sheets_Backend para cada fecha dentro del período de repetición según la frecuencia seleccionada.
3. WHEN el Cuidador elimina una instancia individual de un turno repetitivo, THE Sistema_Turnos SHALL eliminar únicamente esa instancia sin afectar las demás.
4. IF el Cuidador intenta crear un turno repetitivo que genera conflictos con turnos existentes en alguna de las fechas, THEN THE Sistema_Turnos SHALL informar al Cuidador de las fechas con conflicto y permitir omitir esas fechas o cancelar la operación.

---

### Requisito 5: Bloqueo de horarios

**User Story:** Como administrador, quiero bloquear horarios de un cuidador específico para impedir que se le asignen turnos durante un período determinado, para gestionar ausencias, vacaciones o restricciones.

#### Criterios de Aceptación

1. WHEN el Administrador selecciona la opción de bloquear horario, THE Sistema_Turnos SHALL permitir seleccionar un cuidador, una fecha de inicio, una fecha de fin, y opcionalmente un rango horario específico dentro de cada día.
2. WHEN un bloqueo de horario está activo para un cuidador, THE Sistema_Turnos SHALL impedir la creación de turnos para ese cuidador en las fechas y horas bloqueadas, mostrando un mensaje explicativo.
3. WHEN el Administrador configura un bloqueo, THE Sistema_Turnos SHALL ofrecer la opción de hacerlo repetitivo (semanal) con una fecha de fin del período de repetición.
4. WHEN un día tiene un bloqueo activo, THE Sistema_Turnos SHALL mostrar una indicación visual en la vista semanal de turnos identificando el bloqueo y el cuidador afectado.
5. WHEN el Administrador elimina un bloqueo, THE Sistema_Turnos SHALL permitir la asignación de turnos nuevamente en las fechas y horas previamente bloqueadas.

---

### Requisito 6: Rediseño global de botones

**User Story:** Como usuario, quiero que todos los botones de la aplicación sean claramente identificables como elementos interactivos, para que la navegación sea intuitiva y no confunda botones con otros elementos de la interfaz.

#### Criterios de Aceptación

1. THE Sistema_UI SHALL aplicar a todos los botones de acción principal un estilo con bordes redondeados tipo píldora (border-radius completo), gradientes de color, y sombra sutil para diferenciarlos claramente de otros elementos.
2. THE Sistema_UI SHALL limitar el ancho de los botones de acción para que no ocupen el ancho completo de la pantalla, excepto en casos donde el contexto lo requiera explícitamente (como el botón principal de Marcar Entrada/Salida).
3. THE Sistema_UI SHALL aplicar un efecto visual de retroalimentación (cambio de gradiente o sombra) cuando el usuario presiona un botón.
4. THE Sistema_UI SHALL mantener un tamaño mínimo de área táctil de 44x44 píxeles en todos los botones para cumplir con estándares de accesibilidad.
5. THE Sistema_UI SHALL aplicar el estilo de botón rediseñado de forma consistente en todas las vistas de la aplicación: Registrar, Programar, Historial y Admin.

---

### Requisito 7: Mejoras en el registro histórico por lote

**User Story:** Como cuidador, quiero que el formulario de registro por lote sea más intuitivo, con selección clara del cuidador mediante iconos, avance automático al siguiente día, y soporte para todos los días de la semana, para agilizar el proceso de registro masivo.

#### Criterios de Aceptación

1. WHEN el formulario de registro por lote se abre, THE Sistema_Registro_Lote SHALL mostrar el selector de cuidador como una cuadrícula de iconos/avatares con el nombre debajo de cada uno, en lugar de un menú desplegable.
2. WHEN el formulario de registro por lote se abre, THE Sistema_Registro_Lote SHALL preseleccionar al cuidador correspondiente al perfil de la sesión activa.
3. WHEN el Cuidador agrega un registro a la lista, THE Sistema_Registro_Lote SHALL avanzar automáticamente la fecha al día siguiente calendario, incluyendo sábados y domingos.
4. THE Sistema_Registro_Lote SHALL permitir seleccionar cualquier día de la semana (lunes a domingo) como fecha de registro, sin excluir sábados ni domingos.
5. WHEN el selector de cuidador muestra los avatares, THE Sistema_Registro_Lote SHALL resaltar visualmente el cuidador seleccionado con un borde de color y un indicador de selección.

---

### Requisito 8: Simplificación de la vista de historial

**User Story:** Como usuario, quiero que la vista de historial sea más limpia y fácil de usar, con menos distractores, título destacado, filtros ocultos por defecto, y navegación de meses más intuitiva, para encontrar la información que necesito rápidamente.

#### Criterios de Aceptación

1. THE Sistema_Historial SHALL mostrar el título "Historial de Registros" con un color diferenciado y mayor peso visual que el resto del contenido.
2. WHEN la vista de historial se carga, THE Sistema_Historial SHALL ocultar los filtros (cuidador, tipo de fecha, rango) por defecto y mostrar un botón claramente identificable para expandirlos.
3. WHEN el usuario presiona el botón de filtros, THE Sistema_Historial SHALL expandir la sección de filtros con una animación suave.
4. THE Sistema_Historial SHALL mostrar la navegación de meses con botones de flecha claramente identificables (con mayor contraste, tamaño y estilo de botón), y el nombre del mes como elemento central interactivo.
5. THE Sistema_Historial SHALL reducir el espaciado y la cantidad de elementos visibles simultáneamente para minimizar la sobrecarga visual.

---

### Requisito 9: Notas e imágenes en la lista de historial

**User Story:** Como usuario, quiero ver las notas agregadas y tener la opción de ver imágenes adjuntas directamente en la lista de historial, para tener contexto completo de cada registro sin navegar a otra pantalla.

#### Criterios de Aceptación

1. WHEN un registro de tiempo tiene notas asociadas, THE Sistema_Historial SHALL mostrar las notas debajo de la información de horas en la tarjeta del registro.
2. WHEN un registro de tiempo tiene imágenes adjuntas, THE Sistema_Historial SHALL mostrar un botón o indicador con el número de imágenes disponibles.
3. WHEN el usuario presiona el indicador de imágenes, THE Sistema_Historial SHALL mostrar las imágenes en un visor modal que permita navegar entre ellas.
4. IF un registro no tiene notas ni imágenes, THEN THE Sistema_Historial SHALL mostrar la tarjeta del registro sin secciones adicionales de notas o imágenes.

---

### Requisito 10: Semana inicia en lunes y mejora de navegación semanal

**User Story:** Como usuario, quiero que la vista semanal de turnos comience en lunes en lugar de domingo, y que los botones de navegación entre semanas tengan mayor contraste y sean claramente identificables, para que la experiencia sea más natural y fácil de usar.

#### Criterios de Aceptación

1. THE Sistema_Turnos SHALL mostrar la vista semanal comenzando en lunes y terminando en domingo.
2. THE Sistema_Turnos SHALL mostrar los botones de navegación entre semanas (anterior/siguiente) con estilo de botón claramente identificable, incluyendo borde, fondo con contraste, y tamaño adecuado para interacción táctil.
3. WHEN el usuario presiona el botón de semana anterior o siguiente, THE Sistema_Turnos SHALL navegar a la semana correspondiente y actualizar la vista.
4. THE Sistema_Turnos SHALL mostrar el rango de fechas de la semana actual con formato claro que incluya el día de inicio (lunes) y el día de fin (domingo).

---

### Requisito 11: Marcado masivo de pagos

**User Story:** Como administrador, quiero seleccionar múltiples registros para marcarlos como pagados de una sola vez, o indicar que todo el mes está pagado, para agilizar el proceso de gestión de pagos.

#### Criterios de Aceptación

1. WHEN el Administrador está en la vista de historial, THE Sistema_Pagos SHALL ofrecer un modo de selección múltiple que permita marcar varios registros simultáneamente.
2. WHEN el Administrador activa el modo de selección múltiple, THE Sistema_Pagos SHALL mostrar casillas de verificación junto a cada registro no pagado.
3. WHEN el Administrador ha seleccionado uno o más registros, THE Sistema_Pagos SHALL mostrar un botón flotante o fijo para "Marcar seleccionados como pagados" con el conteo de registros seleccionados.
4. WHEN el Administrador confirma el marcado masivo, THE Sistema_Pagos SHALL actualizar el estado de pago de todos los registros seleccionados en el Google_Sheets_Backend.
5. WHEN el Administrador está en la vista de historial filtrada por mes, THE Sistema_Pagos SHALL ofrecer un botón para "Marcar todo el mes como pagado" que aplique a todos los registros no pagados del mes visible.

---

### Requisito 12: Recibos de pago con notas, descripción e imagen

**User Story:** Como administrador, quiero agregar un recibo de pago con notas, descripción e imagen adjunta, y como cuidador quiero poder confirmar que recibí el pago e indicar el monto recibido, para tener un registro completo y verificable de los pagos.

#### Criterios de Aceptación

1. WHEN el Administrador marca registros como pagados, THE Sistema_Pagos SHALL ofrecer la opción de adjuntar un recibo de pago que incluya campos para notas, descripción y una imagen.
2. WHEN el Administrador adjunta un recibo de pago, THE Sistema_Pagos SHALL almacenar la información del recibo asociada al período o registros correspondientes en el Google_Sheets_Backend.
3. WHEN un pago ha sido registrado por el Administrador, THE Sistema_Pagos SHALL mostrar al Cuidador un botón para confirmar que el pago fue recibido.
4. WHEN el Cuidador confirma la recepción del pago, THE Sistema_Pagos SHALL permitir al Cuidador indicar el monto recibido.
5. WHEN el Cuidador está en la vista de historial, THE Sistema_Pagos SHALL ofrecer la opción de aprobar el pago para todo el mes o seleccionar registros específicos para confirmar.

---

### Requisito 13: Anticipos de pago

**User Story:** Como administrador, quiero registrar un anticipo o abono para un cuidador sin especificar a qué actividad corresponde, para llevar un control de los pagos adelantados que se descontarán en la liquidación.

#### Criterios de Aceptación

1. WHEN el Administrador selecciona la opción de registrar un anticipo, THE Sistema_Pagos SHALL mostrar un formulario con campos para: cuidador, monto, fecha y descripción opcional.
2. WHEN el Administrador confirma el anticipo, THE Sistema_Pagos SHALL almacenar el registro del anticipo en una hoja dedicada del Google_Sheets_Backend asociado al cuidador y al mes correspondiente.
3. WHEN el Sistema_Pagos calcula la liquidación de un cuidador para un mes, THE Sistema_Pagos SHALL descontar automáticamente los anticipos registrados para ese cuidador en ese mes del total a pagar.
4. WHEN el Cuidador visualiza su historial, THE Sistema_Pagos SHALL mostrar los anticipos recibidos como actividad diferenciada, indicando fecha, monto y descripción.
5. WHEN el Cuidador visualiza un anticipo, THE Sistema_Pagos SHALL ofrecer un botón para confirmar que el anticipo fue recibido correctamente.

---

### Requisito 14: Gestión de alertas con edición de horario

**User Story:** Como administrador, quiero que al hacer clic en una alerta pueda editar directamente el horario o aprobar la inconsistencia, para resolver problemas rápidamente sin tener que navegar a otras secciones.

#### Criterios de Aceptación

1. WHEN el Administrador hace clic en una alerta, THE Sistema_Alertas SHALL mostrar un panel de detalle con la información completa de la alerta y opciones de acción.
2. WHEN la alerta es de tipo inconsistencia de horario, THE Sistema_Alertas SHALL ofrecer la opción de editar directamente el registro de tiempo asociado desde el panel de la alerta.
3. WHEN la alerta es de tipo cruce de horarios, THE Sistema_Alertas SHALL ofrecer la opción de aprobar el cruce (marcar como resuelto) o editar los registros involucrados.
4. WHEN el Administrador edita un registro desde una alerta, THE Sistema_Alertas SHALL actualizar el registro en el Google_Sheets_Backend y marcar la alerta como resuelta automáticamente.
5. WHEN el Administrador aprueba una inconsistencia, THE Sistema_Alertas SHALL marcar la alerta como resuelta y registrar la aprobación.

---

### Requisito 15: Gastos extra y dinero recibido en turnos activos

**User Story:** Como cuidador, quiero registrar gastos extra (transporte, alimentación, etc.) y dinero recibido para actividades diarias durante un turno activo, para que estos montos se consideren en la liquidación final.

#### Criterios de Aceptación

1. WHILE un Cuidador tiene un turno activo, THE Sistema_Pagos SHALL mostrar opciones para registrar gastos extra y dinero recibido.
2. WHEN el Cuidador registra un gasto extra, THE Sistema_Pagos SHALL solicitar una descripción y un monto, y almacenar el registro asociado al turno activo en el Google_Sheets_Backend.
3. WHEN el Cuidador registra dinero recibido para actividades diarias, THE Sistema_Pagos SHALL solicitar una descripción y un monto, y almacenar el registro asociado al turno activo en el Google_Sheets_Backend.
4. WHEN el Sistema_Pagos calcula la liquidación, THE Sistema_Pagos SHALL sumar los gastos extra al total a pagar al cuidador y restar el dinero recibido del total a pagar.
5. WHEN el Cuidador o el Administrador visualiza el historial, THE Sistema_Pagos SHALL mostrar los gastos extra y dinero recibido asociados a cada registro, identificando claramente la fecha, descripción y monto de cada uno.
6. THE Sistema_Pagos SHALL mostrar un resumen de gastos y dinero recibido en la sección de liquidación, diferenciando claramente los montos gastados de los montos recibidos.

---

### Requisito 16: Confirmación de pagos por parte del cuidador

**User Story:** Como cuidador, quiero poder confirmar que un pago indicado por el administrador fue efectivamente recibido, y ver la actividad de anticipos y pagos realizados, para tener transparencia en el proceso de pagos.

#### Criterios de Aceptación

1. WHEN el Administrador ha marcado registros como pagados, THE Sistema_Pagos SHALL mostrar al Cuidador un indicador visual en cada registro pagado con un botón para confirmar la recepción del pago.
2. WHEN el Cuidador presiona el botón de confirmar pago, THE Sistema_Pagos SHALL registrar la confirmación en el Google_Sheets_Backend con la fecha y hora de confirmación.
3. WHEN el Cuidador visualiza su historial, THE Sistema_Pagos SHALL mostrar la actividad de anticipos y pagos realizados como entradas diferenciadas en la lista.
4. WHEN el Cuidador confirma un anticipo como correcto, THE Sistema_Pagos SHALL registrar la confirmación del anticipo en el Google_Sheets_Backend.
5. IF el Administrador ha marcado registros como pagados y el Cuidador no ha confirmado, THEN THE Sistema_Pagos SHALL mantener el indicador de "Pendiente de confirmación" visible en los registros correspondientes.
