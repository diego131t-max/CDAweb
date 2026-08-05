---

description: "Tareas de implementación — Endurecimiento de seguridad (ronda 1)"
---

# Tasks: Endurecimiento de seguridad (ronda 1)

**Input**: documentos de diseño en `/specs/002-endurecimiento-seguridad/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **SÍ se incluyen**, y no por gusto: FR-030 exige una prueba que falle si alguien
deja el endpoint de datos personales sin protección, y el principio IV de la constitución
obliga a probar la lógica de autenticación. Son tareas del backend; el frontend se verifica en
navegador porque no tiene otra red de seguridad.

**Organization**: por historia de usuario, en orden de prioridad.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[BACK]** / **[FRONT]**: dominio. **Ninguna tarea cruza los dos lados** — se delega al
  agente `webcda-backend` o `webcda-frontend` según corresponda (constitución, Flujo de
  Desarrollo)
- Cada tarea lleva su ruta de archivo exacta

---

## Phase 1: Setup

**Propósito**: dejar el backend en condiciones de recibir el resto.

- [X] T001 [BACK] Agregar `helmet` ^8.3.0 a las dependencias de `Backend/package.json` con `npm install helmet` desde `Backend/`
- [X] T002 [BACK] Extraer la construcción de la app a `Backend/src/app.ts` (exporta `crearApp()`), dejando `Backend/src/server.ts` con el arranque únicamente. Sin esto no hay forma de levantar la app en un puerto de prueba (D8)

---

## Phase 2: Foundational (BLOQUEANTE)

**Propósito**: registrar helmet **temprano y a propósito**. Si se dejara para el final, su
trampa de orígenes (D5) rompería todo lo verificado antes.

**⚠️ CRÍTICO**: ninguna historia empieza hasta que T004 pase.

- [X] T003 [BACK] Registrar `helmet()` en `Backend/src/app.ts` con `crossOriginResourcePolicy: { policy: "cross-origin" }`, y agregar `app.disable("x-powered-by")` explícito
- [ ] T004 Verificar en el navegador que el sitio **sigue cargando el catálogo de servicios** en `#/agendar`. Si dice "no pudimos cargar la lista de servicios", es exactamente la trampa de D5: revisar `Cross-Origin-Resource-Policy` en la respuesta del API

**Checkpoint**: el API manda cabeceras de seguridad y el sitio funciona igual que antes.

---

## Phase 3: User Story 1 — El panel deja de estar abierto (P1) 🎯 MVP

**Goal**: nadie ve datos personales sin una credencial verificada contra el servidor, y si esa
verificación no se puede hacer, el panel no abre.

**Independent Test**: abrir `#/admin` sin credencial no muestra ningún dato; con la correcta
abre; con el API apagado **no** abre.

### Pruebas de la Historia 1

- [X] T005 [P] [BACK] [US1] Prueba de integración de `GET /api/admin/sesion` en `Backend/src/app.test.ts`: 200 con credencial válida, 401 sin credencial y con credencial incorrecta, 503 con `ADMIN_TOKEN` vacío

### Implementación de la Historia 1

- [X] T006 [P] [BACK] [US1] Crear `Backend/src/rutas/admin.ts` con `crearRutasAdmin({ autenticacionAdmin })` y `GET /sesion` → `200 {"estado":"ok"}` con `Cache-Control: no-store`. **Reusa** `autenticacionAdmin` de `dependencias.ts`; no se escribe una segunda comparación de credenciales ([contracts/admin-sesion.md](./contracts/admin-sesion.md))
- [X] T007 [BACK] [US1] Montar `/api/admin` en `Backend/src/app.ts` (depende de T006)
- [X] T008 [P] [FRONT] [US1] Estado de sesión de administración en `Frontend/utils.js`: `sesionAdmin` con los tres estados de [data-model.md](./data-model.md), lectura y escritura en `sessionStorage` bajo `adminToken`, y `verificarCredencialAdmin()` con `AbortController` a 6 s siguiendo el patrón de `cargarCatalogoServicios`
- [X] T009 [P] [FRONT] [US1] Envolver `JSON.parse` en `try/catch` dentro de `storage.get` de `Frontend/utils.js`. Va en esta historia y no en Polish porque el caso límite "datos corruptos en el navegador: el panel abre igual" es parte de la testabilidad del panel: hoy un valor corrupto lo tumba entero, el mismo tipo de caída total que ya se arregló una vez
- [X] T010 [FRONT] [US1] Crear `Frontend/pages/admin-login.js` con `adminLoginPage(estado)` y `bindAdminLogin()`: formulario de credencial, mensajes distintos para 401 / 429 / 503 / red caída, todos en español y **sin revelar nada sobre la credencial esperada** (depende de T008)
- [X] T011 [FRONT] [US1] Registrar `<script src="./pages/admin-login.js?v=13">` en `Frontend/index.html`, **antes** de `app.js`. Saltarse este paso no da error: la página simplemente no existe
- [X] T012 [FRONT] [US1] En `render()` de `Frontend/app.js`: las cuatro ramas de `/admin` pasan por la puerta —`sin-credencial` → `adminLoginPage()`, `verificando` → aviso de espera, `verificada` → el panel— y acotar el prefijo para que `#/administracion` deje de abrirlo (depende de T008, T010)
- [X] T013 [FRONT] [US1] Botón de cerrar sesión en la barra lateral de `Frontend/pages/admin.js` que descarta la credencial y vuelve a `sin-credencial`

**Checkpoint**: el panel exige credencial, falla cerrado en las cinco condiciones de fallo, y
abre aunque haya datos corruptos guardados.

---

## Phase 4: User Story 2 — Lo que escribe un cliente nunca se ejecuta (P2)

**Goal**: todo dato de origen externo se muestra como texto.

**Independent Test**: una cita con `<img src=x onerror=alert(1)>` en el nombre se ve como texto
literal en el panel.

**⚠️ Esta historia DEBE completarse antes de la Historia 3.** Ver Dependencias.

- [X] T014 [FRONT] [US2] Agregar `escaparHtml(valor)` a `Frontend/utils.js` — **una sola función** que reemplaza `& < > " '`, con el comentario de que todo atributo va entre comillas dobles y de los contextos donde escapar NO alcanza (`href`, `src`, atributo sin comillas) (D1)
- [X] T015 [FRONT] [US2] Aplicarla en `Frontend/utils.js`: `serviceOptions()` (en el `value` **y** en el texto de cada opción) y `textoServiciosChatbot()` (depende de T014)
- [X] T016 [P] [FRONT] [US2] Aplicarla en `Frontend/pages/admin.js`: `reservationsTable`, `vehiclesTable`, `messagesTable` y `appointmentsByServiceMarkup` (depende de T014)
- [X] T017 [P] [FRONT] [US2] Aplicarla en `Frontend/pages/schedule.js`: los `value="${...}"` de los pasos 0, 1 y 2, y el resumen de confirmación (depende de T014)
- [X] T018 [P] [FRONT] [US2] Borrar `appointmentSurveyTable()` de `Frontend/pages/schedule.js`. Es código muerto con el mismo defecto: se elimina, no se corrige (FR-009)
- [X] T019 [P] [FRONT] [US2] Repasar `Frontend/pages/` (`home.js`, `contact.js`, `faq.js`, `services.js`, `tarifas.js`) y `Frontend/chatbot.js` buscando cualquier otra interpolación de dato externo sin tratar. Las constantes de `data.js` no cuentan

**Checkpoint**: ningún dato de origen externo llega crudo al DOM.

---

## Phase 5: User Story 3 — Los mensajes llegan de verdad y quedan protegidos (P3)

**Goal**: los mensajes de contacto viven en el servidor, detrás de credencial, y el formulario
deja de mentir.

**Independent Test**: un mensaje enviado desde un navegador se lee desde **otro** con credencial.

**Requiere la Historia 2 terminada.**

- [ ] T020 [FRONT] [US3] `bindContact()` de `Frontend/pages/contact.js` hace `POST` a `${API_URL}/mensajes` con `Content-Type: application/json` y `{name, email, message}`. Ante fallo —red, 4xx, 5xx, 429— **no** muestra "¡Mensaje Enviado!": avisa en español, ofrece el WhatsApp del CDA y **conserva lo escrito** (FR-011)
- [ ] T021 [FRONT] [US3] `messagesTable` de `Frontend/pages/admin.js` se alimenta de `GET ${API_URL}/mensajes` con `Authorization: Bearer` desde `sessionStorage`, en vez de `storage.get("messages")`. **Tres estados explícitos**, ninguno a medias (caso límite de la spec): 200 → la tabla; 401 → devuelve la sesión a `sin-credencial`; **API caído, 5xx o corte por tiempo → la sección explica que no se pudieron cargar los mensajes y ofrece reintentar, sin dejar la tabla vacía como si no hubiera ninguno**. Las otras tres secciones del panel siguen funcionando (depende de T008, T016)
- [ ] T022 [FRONT] [US3] Quitar de `ensureSeed()` en `Frontend/utils.js` la siembra de mensajes de ejemplo con datos personales ficticios (FR-013)

**Checkpoint**: los mensajes salen del navegador y solo se leen con credencial.

---

## Phase 6: User Story 4 — El sitio no depende de un tercero y declara sus orígenes (P4)

**Goal**: todo el código viene del propio sitio, y los orígenes permitidos están declarados.

**Independent Test**: se recorre el sitio sin una sola petición a `cdn.tailwindcss.com` y sin
violaciones de política en consola, con el diseño intacto.

- [X] T023 [FRONT] [US4] Descargar el script de `https://cdn.tailwindcss.com` a `Frontend/assets/vendor/tailwind.js`, con un comentario de cabecera que diga qué es, de dónde salió y en qué fecha
- [X] T024 [FRONT] [US4] Mover el bloque `tailwind.config` de `Frontend/index.html` a `Frontend/assets/vendor/tailwind-config.js`, cargado **después** de `tailwind.js`
- [X] T025 [FRONT] [US4] Apuntar `Frontend/index.html` a los dos archivos locales y eliminar la etiqueta del CDN (depende de T023, T024)
- [X] T026 [FRONT] [US4] Agregar el `<meta http-equiv="Content-Security-Policy">` a `Frontend/index.html` con la política de D3, **con un comentario HTML justo encima avisando que el `connect-src` lleva el origen del API y hay que cambiarlo al publicar**. El recordatorio va acá además de en `data.js`: la trampa está en este archivo, que es el que se publica
- [X] T027 [FRONT] [US4] Enviar desde `Frontend/server.js` la misma política como cabecera, **más `frame-ancestors 'none'`** (que no funciona en un meta), `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy`
- [X] T028 [FRONT] [US4] Verificar en el navegador que `#/servicios` se ve **idéntica** a antes: es la única página que usa Tailwind, así que si algo se rompió, se rompió ahí. Y que ninguna de las siete rutas reporta violaciones de política. Si se queja del bloque `application/ld+json`, poner su hash SHA-256 en `script-src` — **no aflojar la política**
  - Verificado en Chrome 150 sin interfaz, por el protocolo DevTools: las siete rutas sin una sola violación; el bloque `application/ld+json` **no** se bloquea, así que no hizo falta su hash. `#/servicios` capturada antes (CDN) y después (vendorizado + política): las dos imágenes son **idénticas byte a byte**, y las medidas calculadas de los 277 nodos coinciden una a una. Falta el repaso a ojo en Firefox y en un móvil real

**Checkpoint**: cero código de terceros, orígenes declarados, diseño sin cambios.

---

## Phase 7: User Story 5 — El servicio resiste el abuso y la mala configuración se nota (P5)

**Goal**: límites, configuración que falla ruidosa, constancia sin datos personales, y una
prueba que impide revertir la Historia 1.

**Independent Test**: se supera el límite y se frena; se arranca mal configurado y no queda
nada abierto; se quita el guard y la suite se pone roja.

### Pruebas de la Historia 5

- [X] T029 [P] [BACK] [US5] Ampliar `Backend/src/app.test.ts` con cuatro pruebas: **(a)** `GET /api/mensajes` sin credencial devuelve 401 — la prueba de FR-030; **(b) recorrer los endpoints montados y afirmar que los únicos que responden sin credencial son `POST /api/mensajes`, `GET /api/servicios` y `GET /api/health`** — es el candado de FR-006, para que un endpoint futuro no quede público por descuido. Ojo con la aparente contradicción: FR-006 y la constitución dicen "solo dos operaciones públicas" refiriéndose a **operaciones sobre datos personales**; el catálogo y el chequeo de salud son públicos porque no exponen ninguno, y así quedó justificado en el plan de la funcionalidad 001. La prueba lista los tres y **falla si aparece un cuarto**; **(c)** el 429 del limitador de credencial; **(d)** el tope por omisión del listado
- [X] T030 [BACK] [US5] **Verificar a mano que T029 sirve**: comentar `autenticacionAdmin` en `Backend/src/rutas/mensajes.ts`, correr `npm test` y **ver la suite en rojo**; restaurar y ver el verde. Una prueba de regresión que nunca se vio fallar es una suposición (depende de T029)

### Implementación de la Historia 5

- [X] T031 [P] [BACK] [US5] Crear `Backend/src/middlewares/limitarPeticiones.ts`: fábrica de ventana deslizante en memoria, **clave = SHA-256 truncado de la dirección de red** (nunca la dirección), purga de entradas vencidas, y opción de contar solo los fallos (D4)
- [X] T032 [BACK] [US5] Aplicar los dos limitadores en `Backend/src/app.ts`: 20 peticiones / 15 min en `POST /api/mensajes` (T021 del backlog de 001) y 10 **fallos** / 15 min en `/api/admin` (depende de T031)
- [X] T033 [P] [BACK] [US5] Crear `Backend/src/middlewares/registrarAcceso.ts`: una línea por petición con fecha, método, ruta **sin cadena de consulta**, estado y duración. **Prohibido** cuerpo, cabecera de autorización, cadena de consulta y dirección de red (D9, FR-028)
- [X] T034 [P] [BACK] [US5] Validar el entorno en `Backend/src/config.ts`: `PORT` numérico válido y `CORS_ORIGIN` presente y con forma de URL. Hoy `CORS_ORIGIN` cae en silencio al valor de desarrollo si falta (FR-025)
- [X] T035 [P] [BACK] [US5] En `Backend/src/middlewares/autenticarAdmin.ts`, rechazar por lista explícita la credencial de ejemplo de la plantilla. Tiene 38 caracteres y hoy **pasa** el mínimo de 16: quien copie `.env.example` sin editarlo obtiene un panel protegido por un secreto publicado en el repo (FR-026)
- [X] T036 [P] [BACK] [US5] Actualizar `Backend/.env.example` para que quede explícito que ese valor se rechaza a propósito (depende de T035)
- [X] T037 [P] [BACK] [US5] Tope por omisión de 100 en `validarFiltroMensajes` de `Backend/src/validacion/mensajes.ts`. Hoy, sin `limite`, `GET /api/mensajes` devuelve **todos** los mensajes (FR-024)
- [X] T038 [BACK] [US5] Capturar `unhandledRejection` y `uncaughtException` en `Backend/src/server.ts`: hoy un fallo fuera del ciclo de una petición tumba el proceso sin dejar rastro (FR-029)
- [X] T039 [P] [FRONT] [US5] Endurecer `Frontend/server.js`: `try/catch` alrededor de `decodeURIComponent` (hoy `GET /%` **mata el proceso**), `path.resolve` + comparación con `raiz + path.sep` en vez de `startsWith` a secas, lista de denegación para `server.js`, `*.log` y `.vscode/`, y rechazo de métodos distintos de GET/HEAD (FR-021, FR-022)

**Checkpoint**: el API resiste abuso, falla ruidoso al arrancar mal, y la Historia 1 queda
protegida por una prueba.

---

## Phase 8: Polish

Estas siete no responden a ningún FR de esta especificación: son arreglos oportunistas que
salieron de la misma auditoría y que cuesta más dejar anotados que hacer. Se listan como tales,
sin inventarles un requisito que las respalde.

- [ ] T040 [P] [FRONT] `rel="noopener noreferrer"` en el `target="_blank"` de `whatsappButton()` en `Frontend/utils.js`
- [ ] T041 [P] [FRONT] `sandbox` en el `<iframe>` de Google Maps en `Frontend/pages/contact.js`
- [ ] T042 [P] [FRONT] Usar `Object.hasOwn` al leer `chatbotPrompts[key]` en `Frontend/chatbot.js`: hoy una clave como `constructor` llega al prototipo
- [ ] T043 [P] [FRONT] `min` con la fecha de hoy en los `<input type="date">` de `Frontend/pages/schedule.js` y `Frontend/pages/home.js`: hoy se agendan citas en el pasado
- [ ] T044 [P] [FRONT] Validar el servicio contra el catálogo en `bindQuickAppointment()` de `Frontend/pages/home.js`, que hoy escribe un servicio fijo sin verificarlo. **Cierra deuda de la funcionalidad 001**: es su FR-004, que el formulario rápido esquiva por completo
- [ ] T045 [FRONT] Anotar junto a `API_URL` en `Frontend/data.js` que al publicar hay que cambiar **también** el `connect-src` de la política (el otro recordatorio va en `index.html`, T026)
- [ ] T046 [FRONT] Subir el `?v=` de 12 a **13** en **todos** los recursos de `Frontend/index.html`. Va al final, después de tocar todo lo demás
- [ ] T047 Correr el guion completo de [quickstart.md](./quickstart.md), secciones A y B, y marcar su Definición de terminado

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Setup (1)**: sin dependencias.
- **Foundational (2)**: depende de Setup. **Bloquea todo lo demás** — helmet va temprano a
  propósito, para que su trampa de orígenes aparezca antes de construir encima.
- **Historias (3–7)**: dependen de Foundational.
- **Polish (8)**: al final. T046 (`?v=`) **después** de la última edición del frontend.

### Dependencias entre historias

- **US1 (P1)**: independiente. Es el MVP.
- **US2 (P2)**: independiente.
- **US3 (P3)**: ⚠️ **requiere US2 terminada.** No es preferencia de orden. Hoy el dato sin
  tratar lo escribe la misma persona que lo ve; al mover los mensajes al servidor lo escribe
  cualquiera de internet y lo ve el personal del CDA. Hacer US3 sin US2 **abre un agujero que
  hoy no existe**. También depende de T008 (US1) para la credencial.
- **US4 (P4)**: independiente. Refuerza a US2 pero ninguna se apoya en la otra.
- **US5 (P5)**: independiente. Su T030 valida retroactivamente que US1 no se pueda revertir.

**US1 y US2 pueden ir en cualquier orden.** La única restricción dura es US2 antes que US3.

### Paralelismo

- T005 y T006 (backend de US1) contra T008–T013 (frontend de US1): dominios distintos, agentes
  distintos.
- Dentro de US2: T016, T017, T018 y T019 tocan archivos distintos.
- Dentro de US5: T031, T033, T034, T035, T037 y T039 son independientes entre sí.
- Casi toda la fase 8 es paralelizable, **salvo T046**, que va última.

### Reparto por dominio

| Agente | Tareas | Total |
|---|---|---|
| `webcda-backend` | T001–T003, T005–T007, T029–T038 | 16 |
| `webcda-frontend` | T008–T027, T039–T046 | 28 |
| Verificación en navegador | T004, T028, T047 | 3 |

**Ninguna tarea cruza los dos lados** (constitución, Flujo de Desarrollo).

---

## Implementation Strategy

### MVP (solo la Historia 1)

1. Fases 1 y 2 (Setup + Foundational).
2. Fase 3 (US1).
3. **PARAR Y VALIDAR**: las seis condiciones de B1 en [quickstart.md](./quickstart.md).
4. Con eso, el incumplimiento del principio II queda cerrado. Es entregable por sí solo.

### Entrega incremental

1. Setup + Foundational → el API manda cabeceras y el sitio funciona igual.
2. + US1 → **el panel deja de estar abierto** (MVP).
3. + US2 → nada de lo que escribe un cliente se ejecuta.
4. + US3 → los mensajes llegan de verdad y quedan protegidos. *(requiere US2)*
5. + US4 → cero código de terceros, orígenes declarados.
6. + US5 → límites, configuración ruidosa y la prueba que impide revertir.
7. + Polish → higiene, `?v=` y el guion completo.

---

## Notes

- **Cada tarea que toque `Frontend/` se verifica en el navegador antes de darse por hecha.** No
  hay compilador que avise: solo el navegador dice la verdad (principio IV). Está prohibido
  reportar como terminado algo que solo se leyó.
- Cada tarea del backend cierra con `npx tsc --noEmit` y `npm test` desde `Backend/`.
- Un commit por fase, para que el proceso quede auditable y reversible por etapas.
- **Fuera de alcance de estas tareas**, en la ronda 2 con la base de datos: citas al servidor y
  validadas ahí (T020 de la funcionalidad 001), transporte cifrado, usuarios y sesiones reales,
  cifrado en reposo y retención.
- **Dos pendientes del propietario** que no se resuelven acá (principio I): la cédula que se
  pide y se guarda sin propósito visible, y la ausencia de política de habeas data (Ley 1581 de
  2012) en todo el repositorio. Ver la sección correspondiente de [spec.md](./spec.md).
