# Feature Specification: Endurecimiento de seguridad (ronda 1)

**Feature Branch**: `002-endurecimiento-seguridad`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "Endurecimiento de seguridad del sitio y del API, ronda 1: sin base de datos, con lo que ya existe. El panel de administración no tiene ninguna autenticación y muestra datos personales; el sitio carga un script de terceros sin control; los datos de usuario se interpolan crudos en la página; el API no tiene cabeceras de seguridad ni límite de peticiones."

## Contexto

El CDA de Valledupar es un negocio real con clientes reales. El sitio ya recoge nombre,
teléfono, correo, placa y cédula, y los muestra en un panel de administración.

Una auditoría del repositorio encontró que **ese panel no exige ninguna credencial**:
escribir la dirección del panel en la barra del navegador abre reservas, vehículos, mensajes
y reportes con toda la información personal a la vista. El principio II de la constitución
—NO NEGOCIABLE— existe textualmente por este problema, y hoy está incumplido.

La auditoría encontró además tres cosas que lo agravan:

- El sitio carga un script de un tercero que puede cambiar sin aviso y que, si se
  compromete, controla la página entera. No hay ninguna declaración de qué orígenes están
  permitidos.
- No existe **ninguna** función de escape en todo el frontend: lo que escribe un cliente se
  inserta en la página tal cual. Hoy el daño está contenido porque esos datos no salen del
  navegador de quien los escribió; deja de estarlo en cuanto los datos viajen al servidor.
- El API no envía cabeceras de seguridad, no limita peticiones y no deja constancia de quién
  lee los datos personales.

Esta especificación cubre la **ronda 1: endurecer lo que ya existe**, sin base de datos.
La ronda 2 llega con la migración a Postgres/Supabase.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El panel deja de estar abierto a cualquiera (Priority: P1)

Una persona ajena al CDA escribe la dirección del panel de administración en su navegador.
En vez de la lista de clientes, encuentra una pantalla que le pide una credencial. Sin ella
no ve nada. El personal del CDA, en cambio, ingresa su credencial una vez y trabaja normal
durante esa sesión; al cerrar la pestaña, la credencial se olvida.

**Why this priority**: es el incumplimiento del único principio NO NEGOCIABLE que hoy está
roto, y el motivo por el que se abrió esta funcionalidad. Todo lo demás es defensa en
profundidad sobre un panel que hoy no tiene puerta.

**Independent Test**: se abre el panel sin credencial y no muestra ningún dato; se ingresa
la credencial correcta y muestra el panel; se apaga el servidor y el panel deja de abrir
aunque la credencial sea correcta. Entrega valor por sí sola.

**Acceptance Scenarios**:

1. **Given** una persona sin credencial, **When** abre la dirección del panel, **Then** ve
   una solicitud de credencial y **ningún** dato de clientes.
2. **Given** una persona que ingresa una credencial incorrecta, **When** la envía, **Then**
   el panel no abre y recibe una explicación de por qué, sin pistas sobre la credencial
   correcta.
3. **Given** una persona con la credencial correcta, **When** la envía, **Then** el panel
   abre y sigue abierto mientras dure esa pestaña.
4. **Given** el servidor apagado o inalcanzable, **When** alguien intenta entrar con la
   credencial correcta, **Then** el panel **no** abre y se explica que no se pudo verificar.
   Falla cerrado.
5. **Given** el servidor sin credencial configurada, **When** alguien intenta entrar,
   **Then** el panel **no** abre.
6. **Given** una sesión abierta en el panel, **When** la persona cierra la sesión o cierra
   la pestaña, **Then** la credencial deja de estar disponible y hay que volver a ingresarla.

---

### User Story 2 - Lo que escribe un cliente nunca se ejecuta (Priority: P2)

Un cliente escribe su nombre, su placa o un mensaje. Sea lo que sea que escriba —incluidas
etiquetas o fragmentos que parezcan código— el personal del CDA lo ve como **texto literal**
en el panel. Lo mismo vale para los nombres de servicio que llegan del servidor.

**Why this priority**: va **antes** que la Historia 3 a propósito. Hoy este defecto está
contenido porque los datos no salen del navegador de quien los escribió. En cuanto los
mensajes viajen al servidor (Historia 3), cualquier persona de internet podrá escribir en la
pantalla del personal del CDA. Implementar la Historia 3 sin ésta **empeora** la situación
en vez de mejorarla.

**Independent Test**: se registra una cita y un mensaje cuyos campos contengan etiquetas y
comillas, se abre el panel y se comprueba que aparecen como texto y que no se ejecuta nada.

**Acceptance Scenarios**:

1. **Given** una cita cuyo nombre contiene una etiqueta de imagen con un manejador de error,
   **When** el personal abre el panel, **Then** ve el texto tal cual y no ocurre ninguna
   acción automática.
2. **Given** un campo cuyo contenido incluye comillas dobles, **When** ese valor se vuelve a
   mostrar dentro de un formulario, **Then** el formulario conserva su estructura y el valor
   se muestra completo.
3. **Given** un nombre de servicio recibido del servidor con contenido inesperado, **When**
   aparece en el agendamiento, en el asistente o en el panel, **Then** se muestra como texto.
4. **Given** cualquier vista que muestre datos de clientes, **When** se revisa, **Then** no
   queda ningún punto donde el dato se inserte sin tratar.

---

### User Story 3 - Los mensajes de contacto llegan de verdad y quedan protegidos (Priority: P3)

Un cliente escribe por el formulario de contacto. El mensaje **llega al CDA** y queda
guardado en el servidor, no en el navegador del cliente. Si por algún motivo no llega, el
cliente se entera en el momento y puede reintentar o llamar. El personal lee esos mensajes
desde el panel, detrás de credencial.

**Why this priority**: hoy el formulario dice "¡Mensaje Enviado!" sin enviar nada a ningún
lado — el mensaje se guarda en el navegador del propio cliente y el CDA nunca lo ve. Es una
promesa incumplida a un cliente real. Además, mover los mensajes al servidor es lo que
convierte la puerta de la Historia 1 en protección real y no solamente en una cortina.

**Independent Test**: se envía un mensaje desde un navegador y se comprueba que aparece en
el panel abierto desde **otro** navegador con credencial; con el servidor apagado, el
formulario informa el fallo en vez de afirmar que se envió.

**Acceptance Scenarios**:

1. **Given** un cliente que completa el formulario de contacto, **When** lo envía y el
   servidor lo recibe, **Then** ve una confirmación y el mensaje queda registrado en el CDA.
2. **Given** el servidor caído o inalcanzable, **When** el cliente envía el formulario,
   **Then** recibe un aviso claro de que **no** se pudo enviar, con una alternativa de
   contacto, y el formulario conserva lo que escribió.
3. **Given** mensajes registrados, **When** el personal abre la sección de mensajes del panel
   con credencial, **Then** los ve, ordenados y completos.
4. **Given** un visitante nuevo, **When** abre el sitio por primera vez, **Then** su
   navegador **no** recibe ningún dato personal de ejemplo.

---

### User Story 4 - El sitio no depende de un tercero y declara sus orígenes (Priority: P4)

El sitio deja de pedirle código a un servidor externo cada vez que alguien lo visita, y
declara explícitamente desde dónde puede cargar código, estilos, imágenes, tipografías y a
dónde puede conectarse. Para el visitante, el sitio se ve y funciona exactamente igual.

**Why this priority**: un tercero con permiso para ejecutar código en la página puede leer
todo lo que el visitante escribe. Además, la declaración de orígenes es la segunda barrera
que hace que un fallo de la Historia 2 no llegue a ejecutarse.

**Independent Test**: se navega el sitio completo sin conexión a ese tercero y se comprueba
que el diseño está intacto y que la consola no reporta orígenes bloqueados.

**Acceptance Scenarios**:

1. **Given** el sitio publicado, **When** se carga cualquier página, **Then** todo el código
   que ejecuta proviene del propio sitio.
2. **Given** cualquiera de las rutas del sitio, **When** se recorre con la consola abierta,
   **Then** no hay recursos bloqueados ni errores de origen, y el diseño es el mismo que antes.
3. **Given** un intento de ejecutar código insertado en la página, **When** el navegador lo
   procesa, **Then** lo bloquea por no provenir de un origen declarado.
4. **Given** un tercero que intente mostrar el sitio dentro de otra página, **When** lo
   intenta, **Then** el navegador lo impide.

---

### User Story 5 - El servicio resiste el abuso y la mala configuración se nota temprano (Priority: P5)

El API no se puede inundar de peticiones ni usar para adivinar la credencial del panel
probando una tras otra. Una configuración incorrecta del servidor se hace notar **al
arrancar**, no meses después en producción. Queda constancia de los accesos a datos
personales, sin que esa constancia contenga datos personales. Y existe una prueba automática
que falla si alguien deja el endpoint de datos personales sin protección.

**Why this priority**: son las defensas que evitan que las anteriores se degraden con el
tiempo o se rompan por descuido. La prueba automática es la que impide que la Historia 1 se
revierta sin que nadie se entere.

**Independent Test**: se envían muchas peticiones seguidas y el servicio las frena; se
arranca el servidor con configuración incompleta y se niega a operar en abierto; se quita la
protección del endpoint de datos personales y la suite de pruebas se pone en rojo.

**Acceptance Scenarios**:

1. **Given** un mismo origen enviando formularios de contacto sin parar, **When** supera el
   límite, **Then** las peticiones siguientes se rechazan con una explicación y el servicio
   sigue atendiendo al resto.
2. **Given** intentos repetidos de credencial incorrecta, **When** superan un umbral bajo,
   **Then** se frenan durante un lapso, de modo que probar credenciales una a una deje de ser
   viable.
3. **Given** el servidor arrancando sin la configuración de origen permitido, **When**
   inicia, **Then** lo informa y **no** asume silenciosamente un valor de desarrollo.
4. **Given** el servidor arrancando con la credencial de ejemplo que viene en la plantilla de
   configuración, **When** inicia, **Then** la rechaza igual que si no existiera: los
   endpoints de administración no quedan abiertos.
5. **Given** un acceso a datos personales, **When** ocurre, **Then** queda registrado con
   fecha, operación y resultado, y **sin** ningún dato personal, credencial ni dirección de red.
6. **Given** alguien que quita la protección del endpoint de datos personales, **When** corre
   la suite de pruebas, **Then** falla.
7. **Given** una petición malformada al servidor del sitio, **When** llega, **Then** se
   responde con un error y el servidor **sigue funcionando**.
8. **Given** una petición que apunta fuera de la carpeta del sitio, **When** llega, **Then**
   se rechaza.

---

### Edge Cases

- **El servidor responde pero tarda.** La verificación de credencial tiene que cortar por
  tiempo y tratar la demora como fallo: el panel no abre.
- **Credencial válida guardada y el servidor se cae después.** Al pedir datos, la respuesta
  no llega: el panel muestra el fallo y no inventa datos ni deja secciones a medias.
- **Credencial revocada mientras hay una sesión abierta.** La siguiente petición se rechaza y
  la persona vuelve a la pantalla de credencial.
- **Dos pestañas del panel abiertas.** Cada una mantiene su propia sesión; cerrar una no
  cierra la otra.
- **Datos guardados en el navegador que quedaron corruptos.** El panel abre igual y explica
  qué sección no se pudo mostrar, en vez de caerse entero.
- **Una cita registrada antes de esta funcionalidad, con contenido peligroso.** Se muestra
  como texto igual que las nuevas: el tratamiento va en la vista, no en el guardado.
- **El límite de peticiones y un cliente legítimo.** Una familia o una oficina detrás de una
  misma conexión no debe quedar bloqueada por el uso normal de otra persona.
- **El tercero que se deja de usar sigue en la caché del navegador.** El cambio de versión de
  los recursos tiene que forzar la recarga.

## Requirements *(mandatory)*

### Functional Requirements

**Acceso a datos personales**

- **FR-001**: El sistema DEBE exigir una credencial verificada **contra el servidor** para
  mostrar cualquier vista que contenga datos personales de clientes. La verificación no puede
  resolverse solo en el navegador.
- **FR-002**: Cuando la verificación no se pueda completar —servidor caído, credencial no
  configurada, red caída o demora excesiva— el sistema DEBE negar el acceso. Está PROHIBIDO
  degradar a acceso abierto o mostrar datos parciales.
- **FR-003**: La credencial DEBE conservarse solo mientras dure la pestaña del navegador, y
  NO DEBE aparecer nunca en la dirección de la página ni sobrevivir a su cierre.
- **FR-004**: El sistema DEBE ofrecer una forma explícita de cerrar la sesión que descarte la
  credencial.
- **FR-005**: Los mensajes de error de la verificación NO DEBEN revelar información sobre la
  credencial esperada.
- **FR-006**: Solo dos operaciones siguen siendo públicas: registrar una cita y enviar un
  mensaje de contacto.

**Tratamiento de lo que escriben las personas**

- **FR-007**: Todo dato de origen externo —escrito por un cliente o recibido del servidor—
  DEBE mostrarse como texto. NO DEBE poder alterar la estructura de la página ni ejecutarse.
- **FR-008**: Esto DEBE cumplirse también cuando el dato se muestra dentro de un formulario
  que la persona puede seguir editando.
- **FR-009**: El código que muestre datos sin este tratamiento y que no se use DEBE
  eliminarse, no corregirse.

**Mensajes de contacto**

- **FR-010**: Los mensajes de contacto DEBEN registrarse en el servidor, no en el navegador
  del cliente.
- **FR-011**: El sistema NO DEBE confirmar el envío de un mensaje que no se envió. Ante un
  fallo DEBE informarlo, ofrecer una alternativa de contacto y conservar lo que la persona
  escribió.
- **FR-012**: La lectura de mensajes registrados DEBE exigir credencial (FR-001).
- **FR-013**: El sistema NO DEBE sembrar datos personales de ejemplo en el navegador de los
  visitantes.

**Origen del código**

- **FR-014**: Todo el código que el sitio ejecuta DEBE provenir del propio sitio.
- **FR-015**: El sitio DEBE declarar explícitamente los orígenes permitidos para código,
  estilos, tipografías, imágenes, marcos incrustados y conexiones salientes.
- **FR-016**: Esa declaración DEBE impedir la ejecución de código insertado en la página.
- **FR-017**: El sitio NO DEBE poder mostrarse dentro de una página de terceros.
- **FR-018**: La apariencia y el comportamiento del sitio DEBEN quedar sin cambios.

**Resistencia del servicio**

- **FR-019**: El sistema DEBE limitar la cantidad de peticiones que un mismo origen puede
  hacer a las operaciones públicas.
- **FR-020**: El sistema DEBE limitar, con un umbral más estricto, los intentos fallidos de
  credencial, de modo que probarlas una a una no sea viable.
- **FR-021**: El servidor del sitio DEBE seguir funcionando ante una petición malformada.
- **FR-022**: El servidor del sitio NO DEBE entregar archivos fuera de la carpeta del sitio,
  ni sus propios archivos de operación.
- **FR-023**: El API DEBE enviar las cabeceras de seguridad estándar y NO DEBE revelar el
  software que lo ejecuta.
- **FR-024**: Las respuestas que devuelvan listas de datos personales DEBEN tener un tope por
  omisión.

**Configuración y constancia**

- **FR-025**: Una configuración incompleta o inválida DEBE hacerse notar al arrancar. El
  sistema NO DEBE asumir silenciosamente valores de desarrollo.
- **FR-026**: El sistema DEBE rechazar la credencial de ejemplo publicada en la plantilla de
  configuración, con el mismo resultado que si no existiera.
- **FR-027**: Los accesos a datos personales DEBEN quedar registrados con fecha, operación y
  resultado.
- **FR-028**: Ese registro NO DEBE contener datos personales, credenciales ni direcciones de
  red. La dirección de red se considera dato personal.
- **FR-029**: Un fallo fuera del ciclo de atención de una petición NO DEBE tumbar el servicio
  sin dejar constancia.

**Que no se revierta**

- **FR-030**: DEBE existir una prueba automática que falle si el endpoint que expone datos
  personales queda sin protección.
- **FR-031**: Al modificar recursos del sitio DEBE subirse el número de versión de la caché.

### Key Entities

- **Sesión de administración**: la credencial en uso durante una pestaña. Atributos: la
  credencial y su estado de verificación. Existe solo en memoria del navegador y se descarta
  al cerrar la pestaña o al cerrar sesión.
- **Mensaje de contacto**: nombre, correo, texto y fecha. Pasa a vivir en el servidor.
  Su lectura exige credencial; su creación es pública.
- **Cita**: nombre, teléfono, correo, placa, tipo de vehículo, servicio, fecha, hora y pago.
  **Sigue viviendo en el navegador** en esta ronda (ver Fuera de alcance).
- **Registro de acceso**: fecha, operación, resultado. Sin datos personales.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cero datos personales visibles sin credencial. Una persona sin credencial que
  intente entrar al panel por cualquier vía obtiene cero registros de clientes.
- **SC-002**: En las cinco condiciones de fallo —sin credencial, credencial incorrecta,
  servidor caído, servidor sin credencial configurada, demora excesiva— el panel no abre en
  ninguna. Cinco de cinco.
- **SC-003**: Un mensaje enviado desde un navegador se puede leer desde otro equipo distinto
  con credencial, y no se puede leer sin ella.
- **SC-004**: El formulario de contacto nunca confirma un envío que no ocurrió: con el
  servidor apagado, el 100% de los intentos informa el fallo.
- **SC-005**: Ningún dato escrito por un cliente se ejecuta. Se prueba con una batería de al
  menos cinco contenidos hostiles distintos en cada campo que se muestre en el panel, y en
  todos se ve el texto literal.
- **SC-006**: El sitio funciona sin pedirle código a ningún servidor externo, y las siete
  rutas se recorren sin un solo recurso bloqueado ni diferencia visual respecto de la versión
  anterior.
- **SC-007**: Superado el límite, las peticiones adicionales se rechazan; adivinar la
  credencial probando de a una deja de ser viable en tiempo razonable.
- **SC-008**: Arrancar con configuración incompleta o con la credencial de ejemplo no deja
  ningún endpoint de administración abierto. Cero excepciones.
- **SC-009**: El registro de accesos no contiene ni un solo dato personal, credencial ni
  dirección de red, verificado sobre el registro completo de una sesión de prueba.
- **SC-010**: Quitar la protección del endpoint de datos personales pone la suite de pruebas
  en rojo. Se verifica quitándola a propósito.
- **SC-011**: El servidor del sitio sobrevive a una batería de peticiones malformadas sin
  reiniciarse.

## Assumptions

- **Sigue siendo una credencial compartida**, no usuarios individuales. Es la autenticación
  provisional que ya existe en el servidor. Los usuarios reales llegan en la ronda 2.
- **El personal del CDA que usa el panel es de confianza.** Esta funcionalidad protege contra
  quien no debería entrar, no contra el mal uso de quien legítimamente entró.
- **El límite de peticiones se mantiene en memoria de un solo proceso.** Si el día de mañana
  el API corre en varias instancias, el límite se cuenta por instancia. Aceptable mientras
  haya un proceso.
- **El tope por omisión de la lista de mensajes** se fija en 100 registros, suficiente para el
  volumen actual del CDA.
- **La verificación de credencial corta a los 6 segundos**, el mismo criterio que ya usa el
  sitio para cargar el catálogo de servicios.
- **El sitio se sigue verificando en el navegador**, no con pruebas automatizadas: el frontend
  no tiene compilación ni suite (principio IV de la constitución).
- **Vendorizar el script de terceros no cambia el diseño**, porque una sola página lo usa y su
  comportamiento no depende de dónde se sirva. Se verifica en el navegador antes de dar por
  cerrada la Historia 4.

## Límite conocido de esta ronda

**Las citas siguen viviendo en el navegador.** La credencial del panel protege la vista, y
protege de verdad los mensajes (que pasan al servidor), pero **cualquiera con acceso físico a
ese equipo y las herramientas de desarrollo del navegador puede leer las citas guardadas sin
credencial alguna**.

Lo que esta ronda sí resuelve es el caso concreto que motivó el principio II: quien escribe
la dirección del panel ya no ve nada. Las citas se resuelven al migrarlas al servidor, en la
ronda 2. Esto se documenta acá para que nadie lea "panel autenticado" como "datos personales
protegidos" antes de tiempo.

## Fuera de alcance

Explícitamente diferido a la **ronda 2**, cuando entre la base de datos:

- Migrar las citas al servidor y validarlas ahí (T020 de la funcionalidad 001).
- Transporte cifrado. Hoy el sitio habla con el API sin cifrar, así que en una red hostil el
  catálogo de servicios se puede manipular en tránsito.
- Usuarios individuales, sesiones con vencimiento, rotación y revocación de credenciales.
- Cifrado en reposo, política de retención y purga de datos personales.
- Pérdida de escrituras si el API corre en varios procesos sobre el mismo archivo.

## Pendientes de ratificar con el propietario

Ninguno de estos dos puntos se decide dentro de esta funcionalidad: son decisiones del
propietario del CDA (principio I).

1. **La cédula.** El formulario rápido de la página principal la pide como obligatoria y la
   guarda, pero **no se muestra en ninguna sección del panel, no se envía a ningún lado, y el
   formulario completo de cuatro pasos ni siquiera la pide**. Es un documento de identidad
   almacenado sin propósito visible. Por minimización de datos, si no se usa no debería
   pedirse. **Requiere confirmación antes de salir a producción**, igual que la ratificación
   de los seis servicios (T019).

2. **Política de tratamiento de datos personales.** No hay ninguna mención a habeas data ni a
   la Ley 1581 de 2012 en todo el repositorio. Un negocio colombiano que recoge y conserva
   datos personales necesita política de tratamiento publicada y consentimiento informado en
   los formularios. **El contenido tiene que venir del propietario**; no se redacta acá.

## Dependencias entre historias

- La **Historia 2 debe implementarse antes que la Historia 3.** Hoy los datos que se muestran
  sin tratar los escribió la misma persona que los ve. Al mover los mensajes al servidor, los
  escribe cualquiera de internet y los ve el personal del CDA. Invertir el orden abre un
  problema que hoy no existe.
- La **Historia 4 refuerza a la Historia 2** pero no la reemplaza: son dos barreras
  independientes para el mismo riesgo, y ninguna se apoya en la otra.
- Las Historias 1 y 5 son independientes entre sí y del resto.
