# Feature Specification: Las citas llegan al CDA y los datos viven en un almacenamiento central

**Feature Branch**: `003-persistencia-supabase`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Migrar la persistencia a Supabase/Postgres y hacer que las citas lleguen al CDA."

---

## El problema, en una frase

Hoy un cliente puede completar el formulario de agendamiento en `cdavalledupar.com`, ver
una confirmación en pantalla, y **nadie en el CDA se entera de que existe esa cita**. Se
guarda en el navegador de esa persona y ahí se queda.

El sitio está publicado y atendiendo clientes reales desde el 2026-08-10. Cada día que pasa
es un día en que alguien puede quedarse esperando un turno que el centro nunca recibió.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El personal del CDA ve las citas que agendan los clientes (Priority: P1)

Quien atiende el mostrador abre el panel de administración desde cualquier computador del
centro y ve la lista de citas que los clientes agendaron por el sitio: quién es, cómo
contactarlo, qué servicio pidió, para qué vehículo y para cuándo. La lista es la misma
mirándola desde el computador del mostrador, desde el del propietario o desde un celular.

**Why this priority**: es la razón de ser de esta funcionalidad. Sin esto el formulario de
agendamiento es una promesa incumplida a un cliente real, que es exactamente lo que el
principio I de la constitución prohíbe. Todo lo demás en esta especificación es
infraestructura al servicio de este escenario.

**Independent Test**: agendar una cita desde un navegador y verla aparecer en el panel
abierto en un navegador distinto, en otro equipo. Si eso funciona, la funcionalidad
entrega su valor aunque no se haya migrado nada más.

**Acceptance Scenarios**:

1. **Given** un cliente que completa el formulario de agendamiento desde su celular,
   **When** confirma la cita, **Then** el personal del CDA la ve en el panel desde el
   computador del mostrador, sin haber tocado ese celular.
2. **Given** una cita ya registrada, **When** el personal recarga el panel o entra desde
   otro equipo, **Then** la cita sigue estando, con los mismos datos.
3. **Given** un despliegue o reinicio del servidor, **When** el personal vuelve a abrir el
   panel, **Then** las citas anteriores siguen ahí.
4. **Given** alguien sin credencial, **When** intenta consultar la lista de citas,
   **Then** el sistema se lo niega y no revela ningún dato del cliente.

---

### User Story 2 - El cliente sabe con certeza si su cita quedó registrada (Priority: P1)

Cuando alguien agenda, la confirmación que ve en pantalla refleja la verdad: aparece si y
solo si el CDA efectivamente recibió la cita. Si algo falla, se lo dice con claridad, no
pierde lo que escribió, y le ofrece otra vía para agendar.

**Why this priority**: es P1 junto con la historia 1 porque una sin la otra reintroduce el
mismo daño. Guardar las citas en el servidor pero seguir diciendo "listo" cuando la
escritura falló deja al cliente igual de desatendido que hoy, con el agravante de que
ahora el sistema *parece* funcionar. Este error ya se cometió y se corrigió una vez en el
formulario de contacto; no se vuelve a cometer acá.

**Independent Test**: provocar una falla del almacenamiento y comprobar que la pantalla
avisa del fallo, conserva los datos escritos y ofrece el WhatsApp del CDA.

**Acceptance Scenarios**:

1. **Given** el almacenamiento funcionando, **When** el cliente confirma la cita,
   **Then** ve la confirmación solo después de que el CDA la recibió.
2. **Given** el almacenamiento sin responder, **When** el cliente confirma la cita,
   **Then** ve un mensaje que le dice que no se pudo registrar, conserva todo lo que
   escribió y le ofrece agendar por WhatsApp o por teléfono.
3. **Given** una demora larga del almacenamiento, **When** pasa el tiempo de espera,
   **Then** la demora se trata como fallo y no como éxito.
4. **Given** un cliente que elige un servicio que el CDA no presta, **When** intenta
   agendar, **Then** el servidor rechaza la cita, sin depender de que el navegador lo
   haya impedido.

---

### User Story 3 - Los mensajes de contacto se mudan sin perderse (Priority: P2)

Los mensajes que hoy están guardados siguen estando después de la mudanza, y los nuevos se
guardan en el mismo lugar que las citas.

**Why this priority**: es P2 porque los mensajes **hoy ya funcionan**: llegan al CDA y
sobreviven a los despliegues sobre el volumen. Mudarlos mejora respaldos y consultas, pero
no arregla nada roto. Va después de las citas, que sí están rotas.

**Independent Test**: contar los mensajes antes de la mudanza, ejecutarla, y comprobar que
están todos y con los mismos datos.

**Acceptance Scenarios**:

1. **Given** mensajes guardados en el almacenamiento anterior, **When** se ejecuta la
   mudanza, **Then** el panel los sigue mostrando todos, con fecha, nombre, correo y texto
   intactos.
2. **Given** la mudanza ya hecha, **When** un visitante envía un mensaje nuevo,
   **Then** se guarda en el almacenamiento nuevo y aparece en el panel.
3. **Given** la mudanza ya hecha, **When** alguien vuelve a ejecutarla por error,
   **Then** no se duplican los mensajes.

---

### User Story 4 - El personal marca lo que ya atendió (Priority: P2)

Quien atiende el mostrador marca una cita como atendida cuando el vehículo pasó por la
revisión, o como cancelada cuando el cliente avisó que no viene. El panel deja de ser una
lista que solo crece y pasa a reflejar el día de trabajo real.

**Why this priority**: sin esto el panel acumula citas viejas mezcladas con las de hoy y a
la semana deja de servir para operar. No es P1 porque el valor central —que las citas
lleguen— ya se entrega sin ella, y agregarla después no obliga a rehacer nada.

**Independent Test**: marcar una cita como atendida desde un equipo y comprobar el cambio
desde otro.

**Acceptance Scenarios**:

1. **Given** una cita pendiente, **When** el personal la marca como atendida, **Then** el
   cambio queda registrado y se ve desde cualquier equipo.
2. **Given** una cita pendiente, **When** el personal la marca como cancelada, **Then** la
   cita no desaparece: queda registrada como cancelada.
3. **Given** alguien sin credencial, **When** intenta cambiar el estado de una cita,
   **Then** el sistema se lo niega.
4. **Given** un fallo del almacenamiento, **When** el personal intenta cambiar un estado,
   **Then** el panel avisa que no se pudo y el estado que muestra sigue siendo el real.

---

### User Story 5 - El cliente recibe un correo de su cita (Priority: P3)

Después de agendar, el cliente recibe un correo con los datos de su cita: qué servicio,
para qué vehículo, cuándo, y cómo contactar al CDA. Le queda algo a mano cuando cierre la
pestaña.

**Why this priority**: es lo último de la lista porque el valor central se entrega sin
esto, requiere contratar un servicio de correo que hoy no existe, y su fallo no puede
afectar el registro de la cita. Se construye encima de lo demás, no antes.

**Independent Test**: agendar con un correo real y recibir el mensaje, y agendar con el
servicio de correo caído y comprobar que la cita igual queda registrada.

**Acceptance Scenarios**:

1. **Given** un cliente que dejó su correo, **When** la cita queda registrada, **Then**
   recibe un correo en español con los datos de su cita y el contacto del CDA.
2. **Given** un cliente que NO dejó correo (el campo es opcional), **When** la cita queda
   registrada, **Then** la cita se registra igual y no se intenta ningún envío.
3. **Given** el servicio de correo caído, **When** un cliente agenda, **Then** **la cita
   queda registrada igual** y el cliente ve la confirmación en pantalla; el correo se da
   por no enviado.
4. **Given** el servicio de correo caído, **When** el cliente ve la confirmación,
   **Then** esa pantalla **NO DEBE** afirmar que se le envió un correo.

---

### Edge Cases

- **El almacenamiento no responde al arrancar el sistema.** El arranque se corta con un
  mensaje que dice qué falta. No se cae en silencio a un almacenamiento alternativo:
  hacerlo dejaría al CDA recibiendo citas en un lugar que nadie mira.
- **El almacenamiento se cae mientras el sitio está en línea.** Consultar el catálogo de
  servicios y navegar el sitio siguen funcionando; agendar y escribir avisan que no se
  pudo y ofrecen otra vía. El sitio informativo no se cae porque la base esté caída.
- **Dos personas agendan el mismo horario al mismo tiempo.** Ver la pregunta abierta sobre
  cupos más abajo.
- **Una cita con datos que ya no son válidos** (un servicio que el CDA dejó de prestar
  después de que la cita se creó). La cita registrada no se altera; el catálogo cambia
  hacia adelante, no hacia atrás.
- **Citas que hoy existen solo en el navegador de un visitante.** No se pueden recuperar:
  están en dispositivos ajenos y el CDA nunca las tuvo. Se asumen perdidas y no se
  intenta rescatarlas.
- **Alguien envía una placa o un nombre con contenido malicioso.** Se guarda como texto y
  se muestra como texto, nunca se ejecuta.

## Requirements *(mandatory)*

### Functional Requirements

**Las citas llegan al CDA**

- **FR-001**: El sistema **DEBE** registrar cada cita agendada en un almacenamiento
  central del CDA, no en el dispositivo de quien agenda.
- **FR-002**: El personal autenticado **DEBE** poder consultar las citas registradas desde
  cualquier dispositivo, obteniendo siempre el mismo resultado.
- **FR-003**: El sistema **DEBE** conservar las citas ante reinicios y despliegues.
- **FR-004**: Crear una cita **DEBE** ser una operación pública; consultarlas **DEBE**
  exigir autenticación y fallar cerrado si no puede verificarse.
- **FR-005**: El sistema **DEBE** rechazar del lado del servidor una cita cuyo servicio no
  esté en el catálogo vigente, sin depender de la validación del navegador.
- **FR-006**: El sistema **DEBE** validar del lado del servidor los datos de la cita
  (nombre, teléfono, placa, fecha y hora), e indicar en español qué campo falló y por qué.
- **FR-007**: El sistema **NO DEBE** aceptar citas con fecha anterior al día en curso en
  Colombia.

**La confirmación dice la verdad**

- **FR-008**: El sitio **DEBE** mostrar la confirmación de una cita únicamente después de
  que el almacenamiento confirmó que la registró.
- **FR-009**: Ante un fallo, una demora excesiva o un rechazo, el sitio **DEBE** avisar que
  la cita no se registró, conservar lo que el cliente escribió y ofrecer una vía
  alternativa de contacto.
- **FR-010**: El panel **DEBE** distinguir "no hay citas" de "no pudimos consultarlas".
  Mostrar una lista vacía cuando la consulta falló le diría al personal que nadie agendó
  cuando la verdad es que no se pudo preguntar.

**Los mensajes se mudan**

- **FR-011**: Los mensajes de contacto existentes **DEBEN** conservarse íntegros al mudar
  el almacenamiento, con su fecha original.
- **FR-012**: La mudanza **DEBE** poder ejecutarse más de una vez sin duplicar registros.
- **FR-013**: Después de la mudanza, mensajes y citas **DEBEN** vivir en el mismo
  almacenamiento.

**Datos personales**

- **FR-014**: Si la configuración del almacenamiento falta o es inválida, el arranque
  **DEBE** cortarse con un mensaje que indique qué falta. Está **PROHIBIDO** degradar a
  otro almacenamiento en silencio.
- **FR-015**: Las credenciales del almacenamiento **NUNCA DEBEN** versionarse.
- **FR-016**: El registro de accesos **NO DEBE** incluir datos personales, cuerpos de
  petición, credenciales, cadenas de consulta ni direcciones de red.
- **FR-017**: Los mensajes de error **NO DEBEN** revelar datos personales ni detalles
  internos del almacenamiento.
- **FR-018**: El acceso a los datos personales desde fuera del sistema (consolas de
  administración del proveedor incluidas) **DEBE** quedar restringido a las credenciales
  del CDA.

**Estado de las citas**

- **FR-019**: El personal autenticado **DEBE** poder cambiar el estado de una cita entre
  pendiente, atendida y cancelada.
- **FR-020**: Cancelar una cita **NO DEBE** borrarla. Queda registrada como cancelada: el
  CDA necesita saber que existió y que no se atendió.
- **FR-021**: Cambiar el estado **DEBE** exigir autenticación y fallar cerrado.
- **FR-022**: Si el cambio de estado falla, el panel **DEBE** avisarlo y seguir mostrando
  el estado real, nunca el que se intentó poner.

**Aviso al cliente**

- **FR-023**: Cuando el cliente haya dejado su correo, el sistema **DEBE** enviarle un
  mensaje en español con el servicio, el vehículo, la fecha y hora, y cómo contactar al CDA.
- **FR-024**: El correo es opcional en el formulario. Sin correo, la cita **DEBE**
  registrarse igual y no **DEBE** intentarse ningún envío.
- **FR-025**: Un fallo del envío **NO DEBE** impedir que la cita quede registrada ni
  revertirla. Registrar la cita y avisarle al cliente son dos cosas distintas y la primera
  manda.
- **FR-026**: La pantalla de confirmación **NO DEBE** afirmar que se envió un correo si el
  envío falló o no se intentó. Prometer un correo que no llega es el mismo error que
  confirmar una cita que no se guardó.
- **FR-027**: El correo **DEBE** enviarse únicamente a la dirección que el propio cliente
  escribió, y **NO DEBE** incluir datos de otras citas ni de otros clientes.

**Pregunta abierta**

- **FR-028**: El sistema **DEBE** [NEEDS CLARIFICATION: ¿hay un límite de citas por franja
  horaria? Hoy nada impide que veinte personas agenden las 8:00 del mismo día. Si el CDA
  tiene una capacidad real por hora, es un dato del negocio que **debe confirmar el
  propietario** — el principio I prohíbe estimarlo. **Consulta pendiente al 2026-08-10.**]

### Key Entities

- **Cita**: una reserva de turno hecha por un cliente. Identidad propia; datos de la
  persona (nombre, teléfono, correo **opcional**), del vehículo (placa, tipo), el servicio
  pedido, la fecha y hora deseadas, el estado de atención y el momento en que se creó.
  El servicio referencia el catálogo vigente al momento de agendar.
  Estados posibles: **pendiente** (recién agendada), **atendida** (el vehículo pasó por la
  revisión) y **cancelada** (no se atendió y no se atenderá). Toda cita nace pendiente.
- **Mensaje de contacto**: una consulta escrita por un visitante. Nombre, correo, texto,
  fecha y momento de creación. Sin relación con la cita: son dos vías de contacto
  independientes.
- **Servicio**: los trabajos que el CDA presta. Ya existe y no cambia en esta
  funcionalidad; acá solo se lo consulta para validar que la cita pide algo real.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las citas agendadas desde el sitio son visibles para el personal
  del CDA, desde cualquier dispositivo. Hoy ese número es 0%.
- **SC-002**: Ninguna confirmación de cita se le muestra a un cliente sin que el CDA la
  haya recibido. Verificable provocando fallos del almacenamiento.
- **SC-003**: Los mensajes de contacto guardados antes de la mudanza siguen siendo el 100%
  después de ella, sin duplicados.
- **SC-004**: Las citas y los mensajes sobreviven a un despliegue y a un reinicio, medido
  registrando uno de cada, redesplegando y volviendo a consultar.
- **SC-005**: Con el almacenamiento caído, el sitio informativo sigue navegable y el
  agendamiento explica el problema en español en menos de 10 segundos, en vez de quedarse
  esperando.
- **SC-006**: El personal encuentra las citas del día sin ayuda ni instrucciones.
- **SC-007**: Un cambio de estado hecho en un equipo es visible en otro en la siguiente
  consulta, sin pasos manuales de por medio.
- **SC-008**: El 100% de las citas quedan registradas aunque el servicio de correo esté
  caído. Verificable desactivando el envío y agendando.
- **SC-009**: Ningún cliente recibe la promesa de un correo que no se envió.

## Assumptions

- **La decisión de tecnología ya está tomada**: el almacenamiento será Supabase/Postgres,
  en un proyecto **nuevo**, creado para el CDA. No se reutiliza el proyecto existente
  `MVP-backend`, que pertenece a otro sistema: no se mezclan datos personales de clientes
  de un negocio real con un prototipo. El detalle técnico vive en el plan, no acá.
- **La arquitectura no se discute en esta funcionalidad**: la persistencia sigue detrás de
  la interfaz de repositorio existente (principio III). Esta funcionalidad escribe
  implementaciones nuevas y cambia el punto de composición; no toca los manejadores HTTP.
  Si para migrar hiciera falta editarlos, es señal de que el diseño se rompió y se corrige
  antes de seguir.
- **El almacenamiento en archivo se retira** una vez completada la mudanza. El volumen de
  Railway queda como respaldo hasta confirmar que la mudanza salió bien.
- **Las citas que hoy están en navegadores de visitantes se dan por perdidas.** Están en
  dispositivos ajenos y el CDA nunca las recibió; no hay forma de recuperarlas ni
  obligación de intentarlo.
- **No entra la autenticación real de usuarios.** El panel sigue detrás del token
  compartido provisional. Que el sistema no pueda decir *quién* del CDA consultó qué sigue
  siendo una limitación conocida, y se resuelve cuando existan usuarios.
- **No entra el borrado ni la edición de mensajes.** Hoy no existen y esta funcionalidad no
  los agrega.
- **No entra editar los datos de una cita** (cambiarle la fecha, el servicio o la placa).
  Solo su estado. Reprogramar se resuelve por teléfono y, si hace falta, agendando de nuevo.
- **El aviso al cliente será por correo, no por WhatsApp.** WhatsApp llega mejor en
  Valledupar, pero exige la API de WhatsApp Business, con costo por mensaje y trámite de
  aprobación. Queda como mejora posterior si el correo resulta insuficiente.
- **El proveedor de correo todavía no está elegido.** Se decide en el plan. Lo que esta
  especificación fija es el comportamiento: el envío es best-effort y nunca condiciona el
  registro de la cita.
- **La política de retención de datos personales** no se define acá; se asume conservación
  indefinida hasta que el propietario fije un plazo. Debería fijarse, dado el alcance de la
  Ley 1581 de 2012.
- **El catálogo de servicios sigue siendo estático en código.** Migrarlo a una tabla es
  otra funcionalidad; acá solo se lo consulta.

## Dependencias

- Requiere una cuenta de Supabase con permiso para crear un proyecto nuevo.
- Requiere un servicio de envío de correo (a elegir en el plan) y una dirección remitente
  del dominio `cdavalledupar.com`, con sus registros de DNS para que los correos no caigan
  en spam.
- Depende del catálogo de servicios de la funcionalidad 001, que se usa para validar el
  servicio pedido.

### Bloqueante

**FR-028 (cupos por franja horaria) está sin responder y depende del propietario del CDA.**
La capacidad operativa del centro es dato del negocio y el principio I prohíbe estimarla.

Esto **no bloquea toda la funcionalidad**: las historias 1 a 5 se pueden planificar y
construir sin ese dato, porque hoy el sistema tampoco valida disponibilidad y no se estaría
empeorando nada. Lo que bloquea es cualquier tarea de control de cupos. Si la respuesta
llega tarde, se construye el resto y el límite se agrega después — pero conviene preguntar
ya, porque si el CDA sí tiene un tope, cada día sin él es un día en que se puede sobrevender
una franja.

## Nota sobre la numeración

Los identificadores `FR-0xx` reinician en cada especificación, siguiendo la convención de
001 y 002. Los comentarios del código que citan `FR-025`, `FR-027` o `FR-028` se refieren a
la **funcionalidad 002**. Al citar requisitos de esta especificación dentro del código,
conviene escribir "FR-003 de la 003" para no dejar la ambigüedad servida.
