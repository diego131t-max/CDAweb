# Tasks: Persistencia central y citas que llegan al CDA

**Funcionalidad**: `003-persistencia-supabase` · **Fecha**: 2026-08-10

**Entrada**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/citas.md](./contracts/citas.md) ·
[quickstart.md](./quickstart.md)

---

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]** — se puede hacer en paralelo con otras [P] de la misma fase: archivos distintos,
  sin dependencias pendientes entre ellas.
- **[US1]…[US5]** — a qué historia de usuario pertenece. Las fases de Setup, Foundational y
  Polish no llevan etiqueta.

**Las pruebas del backend NO son opcionales acá.** El principio IV de la constitución exige
pruebas para la lógica con reglas de negocio —estados, autenticación, validación— y las tres
aparecen en esta funcionalidad. El frontend no tiene pruebas: se verifica en navegador, y no
hay atajo.

---

## Phase 1: Setup

Infraestructura. Nada de esto se ve, y todo lo demás depende de ello.

- [x] T001 Crear el proyecto de Supabase iniciando sesión con `admincdavalledupar@gmail.com`, región `us-east-1`, plan gratuito. **Verificar la región antes de confirmar: no se cambia después** (D4 de research.md)
- [x] T002 Mover los servicios `api` y `sitio` de Railway a **US East** (Settings → Deploy → Region) y redesplegar ambos. Si el plan no permite elegir región, **parar y decidir** antes de seguir: base y API separados es la peor combinación
- [x] T003 [P] Agregar la dependencia `postgres@^3` en `Backend/package.json` y verificar que `npm ci --include=dev && npm run build` sigue pasando
- [x] T004 [P] Borrar el proyecto vacío de Supabase en São Paulo (`zidmmlvhcahyvsplikfc`) para que no quede uno parecido al lado del bueno

---

## Phase 2: Foundational (BLOQUEANTE)

**Ninguna historia puede empezar antes de que esta fase termine.** Acá se construye lo que
hace que un error de configuración se note al arrancar en vez de seis meses después.

- [x] T005 [P] Escribir `Backend/migraciones/001-esquema-cda.sql`: esquema `cda`, tablas `citas` y `mensajes` con las columnas, tipos y `check` de estado de data-model.md
- [x] T006 [P] Escribir `Backend/migraciones/002-indices-y-rls.sql`: los tres índices de data-model.md, `enable row level security` en ambas tablas y **ninguna política**
- [x] T007 Aplicar T005 y T006 desde el editor SQL del panel de Supabase, y verificar con las dos consultas de comprobación de quickstart.md que las tablas están en `cda` y que `relrowsecurity` es `true` en ambas
- [x] T008 Agregar `DATABASE_URL` a `Backend/src/config.ts` siguiendo el patrón de `leerOrigenPermitido`: obligatoria y validada como URL de Postgres; **si falta o es inválida con `NODE_ENV=production`, corta el arranque** (FR-014)
- [x] T009 Escribir pruebas de configuración en `Backend/src/config.test.ts`: sin `DATABASE_URL` en producción corta, con URL malformada corta, con URL válida arranca. **Es la prueba de que falla cerrado**
- [x] T010 Crear `Backend/src/basedatos/conexion.ts`: cliente `postgres.js` con la cadena del **pooler de sesión**, cortes de conexión y consulta por debajo de los 6 s del navegador (D8), y cierre limpio del pool al terminar el proceso
- [x] T011 [P] Crear `Backend/src/tipos/cita.ts` con `Cita`, `NuevaCita`, `EstadoCita` y `FiltroCitas`, replicando el estilo documentado de `tipos/mensaje.ts` (campos del contrato en inglés, comentado el porqué)
- [x] T012 [P] Documentar `DATABASE_URL` en `Backend/.env.example`, incluyendo **el aviso de D2**: va la cadena del pooler de sesión (puerto 5432), no la conexión directa, que es solo IPv6 y falla con `ENETUNREACH` sin mencionar IPv6

---

## Phase 3: User Story 1 — El personal del CDA ve las citas (P1) 🎯 MVP

**Objetivo**: una cita agendada desde el celular de un cliente aparece en el panel abierto en
el computador del mostrador.

**Prueba independiente**: agendar desde un navegador y ver la cita en el panel desde otro
equipo. Si eso funciona, esta historia entregó su valor aunque no exista nada más.

Es el camino feliz completo. Los caminos de fallo son la Historia 2.

### Pruebas de la Historia 1

- [x] T013 [P] [US1] Pruebas de validación en `Backend/src/validacion/citas.test.ts`: campos obligatorios, correo opcional, formato de fecha y hora, **rechazo de servicio fuera del catálogo** (FR-005), **rechazo de fecha pasada en hora de Colombia** (FR-007), y que `id`, `status` y `creadoEn` enviados por el cliente se descartan
- [x] T014 [P] [US1] Pruebas de integración HTTP en `Backend/src/app.test.ts`: `POST /api/citas` devuelve 201 con `id` y `status` generados por el servidor; `GET /api/citas` sin credencial devuelve 401 y **no filtra ningún dato**; con credencial devuelve la lista

### Implementación de la Historia 1

- [x] T015 [P] [US1] Crear `Backend/src/validacion/citas.ts` con lista blanca contra asignación masiva, siguiendo `validacion/mensajes.ts`. Reporta **todos** los campos inválidos de una vez, en español (principio V)
- [x] T016 [P] [US1] Crear la interfaz `Backend/src/repositorios/repositorioCitas.ts` con firmas asíncronas: `crear`, `listar(filtro)`, `cambiarEstado`
- [x] T017 [US1] Crear `Backend/src/repositorios/repositorioCitasPostgres.ts` implementando T016, con el mapeo columna↔campo de data-model.md **explícito** (un mapeo implícito no falla, solo miente)
- [x] T018 [US1] Crear `Backend/src/rutas/citas.ts` con `POST /` y `GET /` según contracts/citas.md, reutilizando `autenticacionAdmin` para el `GET`
- [x] T019 [US1] Montar `/api/citas` en `Backend/src/app.ts` con `soloEnMetodo`: limitador público en `POST`, limitador de credencial en `GET` (D10). **Reutilizar las instancias de `dependencias.ts`**, no crear limitadores nuevos
- [x] T020 [US1] Instanciar `repositorioCitas` en `Backend/src/dependencias.ts`. **Es el único archivo que elige implementación**; si hace falta tocar un manejador, parar y revisar el diseño
- [x] T021 [US1] Reemplazar el guardado en `localStorage` de `Frontend/pages/schedule.js` por `POST` al API. **Dejar de generar el `id` en el navegador** (hoy `CDA-` + milisegundos recortados, que colisiona)
- [x] T022 [US1] Agregar `cargarCitasAdmin()` en `Frontend/utils.js` siguiendo el patrón de `cargarMensajesAdmin`, con corte a 6 s
- [x] T023 [US1] Cambiar `Frontend/pages/admin.js` para que la sección de reservas lea del API en vez de `localStorage`, y escapar todos los campos con `escaparHtml`
- [x] T024 [US1] Subir `?v=` de 15 a **16** en las 15 etiquetas de `Frontend/index.html`
- [ ] T025 [US1] **Verificar en navegador** los pasos 1 a 5 de quickstart.md: agendar en un navegador, ver la cita en otro equipo, y que sobreviva a un redespliegue

---

## Phase 4: User Story 2 — El cliente sabe la verdad sobre su cita (P1)

**Objetivo**: la confirmación aparece si y solo si el CDA recibió la cita. Si falla, se dice,
no se pierde lo escrito, y se ofrece otra vía.

**Prueba independiente**: pausar el proyecto de Supabase, intentar agendar, y comprobar que
la pantalla avisa del fallo en vez de confirmar.

Es P1 junto con la Historia 1 porque una sin la otra reintroduce el mismo daño: un sistema
que dice "listo" sin haber guardado deja al cliente igual de desatendido, con el agravante
de que ahora *parece* funcionar.

### Pruebas de la Historia 2

- [x] T026 [P] [US2] Prueba de integración en `Backend/src/app.test.ts`: con el repositorio fallando, `POST /api/citas` devuelve **503** y el cuerpo **no menciona** el motor, el host ni el error del driver (FR-017)

### Implementación de la Historia 2

- [x] T027 [US2] En `Backend/src/rutas/citas.ts`, mapear los fallos del repositorio a **503** con el texto de contracts/citas.md. Una demora que agota el corte llega acá también: la demora **es** un fallo (D8)
- [x] T028 [US2] En `Frontend/pages/schedule.js`, manejar red caída, corte a 6 s, 400, 429 y 5xx: avisar que **no** se registró, **conservar lo escrito**, ofrecer WhatsApp, y deshabilitar el botón mientras envía. Reutilizar el patrón que ya usa `Frontend/pages/contact.js`
- [x] T029 [US2] En `Frontend/pages/admin.js`, distinguir los tres estados de la lista de citas: cargando, listo (aunque venga vacío) y **error**. "No pudimos consultar" nunca se dibuja como "no hay citas" (FR-010)
- [ ] T030 [US2] **Verificar en navegador** los pasos 6, 7 y 8 de quickstart.md con el proyecto de Supabase pausado: el aviso aparece, lo escrito se conserva, el sitio informativo sigue navegable y el panel dice que no pudo consultar

---

## Phase 5: User Story 3 — Los mensajes se mudan sin perderse (P2)

**Objetivo**: los mensajes guardados siguen estando después de la mudanza, y los nuevos van al
mismo lugar que las citas.

**Prueba independiente**: contar los mensajes antes, mudar, contar después. Y volver a mudar
sin que el número cambie.

Va después de las citas porque los mensajes **hoy funcionan**: llegan al CDA y sobreviven a
los despliegues. Mudarlos mejora respaldos y consultas, no arregla nada roto.

- [X] T031 [P] [US3] Crear `Backend/src/repositorios/repositorioMensajesPostgres.ts` implementando la interfaz `RepositorioMensajes` **sin cambiarla**: mezclar una migración de datos con un cambio de contrato es cómo se pierden datos sin saber cuál de los dos tuvo la culpa
- [X] T032 [P] [US3] Escribir `Backend/scripts/mudar-mensajes.ts`: lee el JSON del volumen e inserta con `on conflict (id) do nothing`, **conservando la fecha original** y no la de la mudanza (D6)
- [X] T033 [US3] Cambiar la línea de `repositorioMensajes` en `Backend/src/dependencias.ts` a la implementación Postgres
- [X] T034 [US3] Ejecutar la mudanza contra producción y verificar: mismo número de mensajes, mismos nombres, mismas fechas — **el volumen de producción estaba vacío**: se recreó al mover los servicios a US East (tramo 1) y los mensajes anteriores se perdieron ahí, antes de esta tarea. Comprobado con `GET /api/mensajes` contra el API viejo: `[]`. El script se corrió igual contra ese caso y reportó "no hay nada que mudar" sin tocar la base
- [X] T035 [US3] **Ejecutar la mudanza por segunda vez** y comprobar que el número no cambia (FR-012). Verificado contra la base **real** con dos registros de prueba: 1.ª corrida 2 insertados (0 → 2), 2.ª corrida 0 insertados (2 → 2). Se comprobó además que `date` y `creadoEn` conservan el valor original y que el listado sale del más reciente al más antiguo. Los registros de prueba se borraron: `cda.mensajes` quedó en 0

---

## Phase 6: User Story 4 — El personal marca lo que ya atendió (P2)

**Objetivo**: el mostrador marca una cita como atendida o cancelada, y el cambio se ve desde
cualquier equipo.

**Prueba independiente**: marcar una cita en un equipo y ver el cambio en otro.

### Pruebas de la Historia 4

- [x] T036 [P] [US4] Pruebas en `Backend/src/app.test.ts`: `PATCH /api/citas/:id/estado` sin credencial devuelve 401; con estado inválido, 400; con id inexistente, 404; con datos válidos, 200 y la cita con el estado nuevo

### Implementación de la Historia 4

- [x] T037 [P] [US4] Agregar la validación de estado en `Backend/src/validacion/citas.ts`: solo `pendiente`, `atendida` o `cancelada`, con el mensaje en español de contracts/citas.md
- [x] T038 [US4] Implementar `cambiarEstado` en `Backend/src/repositorios/repositorioCitasPostgres.ts`. **Cancelar no borra la fila** (FR-020): el CDA necesita saber que la cita existió y no se atendió
- [x] T039 [US4] Agregar `PATCH /:id/estado` en `Backend/src/rutas/citas.ts` detrás de `autenticacionAdmin` y del limitador de credencial
- [x] T040 [US4] Agregar los controles de estado en `Frontend/pages/admin.js`. Ante un fallo, **seguir mostrando el estado anterior**, que es el real (FR-022): nada de pintar el estado optimista
- [x] T041 [US4] ~~Subir `?v=` a **17**~~ — el salto a **16** de T024 ya cubre estos cambios: se hicieron en la misma tanda, así que una sola versión alcanza
- [ ] T042 [US4] **Verificar en navegador** los pasos 3, 4 y 9 de quickstart.md, incluido el de marcar con la base caída

---

## Phase 7: User Story 5 — El cliente recibe un correo de su cita (P3)

**Objetivo**: al cliente le queda algo a mano cuando cierre la pestaña.

**Prueba independiente**: agendar con un correo real y recibirlo; y agendar con el servicio de
correo caído y comprobar que **la cita queda registrada igual**.

Va último porque el valor central se entrega sin esto, requiere contratar un servicio que hoy
no existe, y su fallo no puede afectar el registro de la cita.

- [ ] T043 [P] [US5] Crear la cuenta de Resend, verificar el dominio `cdavalledupar.com` y **agregar sus registros de DNS en Namecheap**. Sin eso los correos caen en spam. **EN ESPERA POR DECISIÓN DEL PROPIETARIO (2026-08-14)**: el código de T044–T047 está desplegado y deliberadamente apagado. Sin `RESEND_API_KEY` ni `CORREO_REMITENTE` no se hace ninguna llamada a la red y el comportamiento del API es idéntico al de antes. Prenderlo es poner esas dos variables en Railway; no hay código pendiente
- [x] T044 [P] [US5] Agregar `RESEND_API_KEY` y `CORREO_REMITENTE` a `Backend/src/config.ts` y a `.env.example`. **Estas dos NO cortan el arranque si faltan**: el correo es best-effort y un API que no arranca por falta de correo sería peor que uno que no manda correos. Un valor **mal escrito** tampoco corta el arranque: se avisa y el correo queda apagado
- [x] T045 [US5] Crear `Backend/src/correo/enviarConfirmacion.ts`: plantilla en español con servicio, vehículo, fecha, hora y contacto del CDA. **Envía solo a la dirección que escribió el cliente** y no incluye datos de otras citas (FR-027). Sin dependencia nueva: `fetch` contra el API de Resend
- [x] T046 [US5] Enganchar el envío en `Backend/src/rutas/citas.ts` **después** de responder el 201 y fuera de la transacción. Si falla, se registra el fallo y **no** se altera la respuesta (FR-025). Sin correo del cliente, no se intenta nada (FR-024)
- [x] T047 [US5] Revisar el texto de confirmación de `Frontend/pages/schedule.js`: dice que la cita quedó registrada y **no promete ningún correo** (FR-026). **Ya cumplía, sin cambios**: dice "Tu cita quedó registrada". Se revisó también la cita rápida del inicio (`home.js`), que dice "Tu solicitud quedó registrada" — igual de correcto
- [ ] T048 [US5] **Verificar** los pasos 10, 11, 12 y 13 de quickstart.md, incluido agendar con la clave de Resend inválida y comprobar que la cita se registra igual

---

## Phase 8: Polish

Solo cuando todo lo anterior pasó.

- [x] T049 Retirar `RepositorioMensajesArchivo` del punto de composición en `Backend/src/dependencias.ts` y borrar la implementación si ya no la usa nadie. Se borraron también `almacenJson.ts` (su único consumidor era ese repositorio) y `config.directorioDatos` (ya no lo leía nadie). `DATA_DIR` se conserva: la lee `scripts/mudar-mensajes.ts` de `process.env` directo
- [ ] T050 **Conservar el volumen de Railway y su contenido al menos una semana** después de la mudanza. Es el único respaldo de los mensajes anteriores hasta que los de Supabase tengan historia propia. No borrar `DATA_DIR` antes de eso
- [ ] T051 [P] Borrar de la base los registros de prueba de esta funcionalidad, incluido el mensaje `PRUEBA - borrar` del despliegue. **Los de la verificación del API ya se borraron**: `cda.citas` y `cda.mensajes` quedaron en 0, comprobado el 2026-08-14. Queda pendiente a propósito porque la verificación en navegador (T025, T030, T042) todavía no se hizo y va a dejar registros nuevos.

  **Pendiente concreto**, de la verificación de T055 en producción:

  ```sql
  delete from cda.citas where id = '6c6e2ae7-d871-44a5-9efe-96f599e7777f';
  -- "PRUEBA TLS - BORRAR", placa TLS001, 2099-12-31
  ```

  El panel no borra citas —solo cambia su estado—, así que esta sale por el editor SQL de Supabase. Está fechada en 2099 a propósito: el listado ordena por fecha ascendente, así que queda al final y no estorba mientras tanto
- [x] T052 [P] Actualizar `CLAUDE.md`: la sección "Cómo se corre" necesita `DATABASE_URL`, y "Estado actual" tiene que dejar de decir que las citas viven en `localStorage`
- [x] T053 [P] Actualizar el agente `.claude/agents/webcda-backend.md`: la migración a Postgres ya no está pendiente, y la convención de acceso a datos ahora incluye `basedatos/conexion.ts`. Estaba desfasado de un proyecto entero: declaraba los estados de una cita como `'pendiente' | 'completada'`, decía que `/admin` estaba abierto y que no había pruebas

### Agregado después de cerrar la funcionalidad

Trabajo que salió de esta funcionalidad pero ya no le pertenece: cada bloque es su propia
rama y su propio commit. Están acá y no en una lista nueva por el mismo motivo del apartado
siguiente — **una lista de pendientes que nadie encuentra no sirve de nada**, y esta es la
que ya se consulta.

#### Rama `004-borrar-citas`

- [x] T056 **Borrar citas desde el panel** (FR-029, 2026-08-14). `DELETE /api/citas/:id` detrás de credencial y del limitador, `borrar()` en la interfaz de repositorio y su implementación en Postgres, botón en `admin.js` con confirmación, y estilo propio para la única acción irreversible del panel. **Solo borra citas canceladas**, y la regla se aplica en el repositorio dentro de una transacción con `for update`: comprobar y borrar en dos consultas sueltas dejaría que un cambio de estado se cuele en el medio. **Revierte parcialmente lo que decía `contracts/citas.md`** ("no existe y no se agrega"), y el porqué está escrito ahí. 7 pruebas nuevas: 115/115
- [ ] T057 **Verificar el borrado en navegador**: cancelar una cita, ver aparecer el botón Borrar, confirmarlo, y comprobar que desaparece y sigue sin estar después de recargar. Probar también que en una cita pendiente el botón **no** aparece

#### Rama `005-hsts-y-trampa` (2026-08-15)

Salió de una revisión de seguridad pedida a mano, no de una especificación. Lo que la
revisión **descartó** también quedó anotado: no hay XSS (el escapado cubre comillas y la CSP
trae `script-src 'self'` sin `unsafe-inline`), no hay superficie de CSRF (el panel va con
`Authorization: Bearer`, no con cookie) y el historial de git no tiene ningún secreto.

- [x] T058 **HSTS en el sitio** (`Frontend/server.js`): `max-age=31536000; includeSubDomains`, el mismo valor que el API ya mandaba. `includeSubDomains` se comprobó seguro **antes** de ponerlo: en ese momento no existía ningún subdominio del sitio en DNS. **Deliberadamente sin `preload`**: entrar a la lista precargada de los navegadores es prácticamente irreversible, y una decisión así no se toma de arrimada en otro cambio
- [x] T059 **Campo trampa en los tres formularios públicos** (`Backend/src/validacion/trampa.ts`, `Frontend/utils.js`): un campo que un humano no ve —fuera de pantalla por CSS, `aria-hidden`, `tabindex="-1"`— y que un robot que rellena todo sí completa. Si viene con contenido, **se responde 400, nunca un 201 falso**: un falso positivo con éxito simulado mostraría "¡Cita Agendada!" para una cita que no existe, que es exactamente el defecto que la 003 vino a eliminar. No se usa `type="hidden"` porque los rellenadores automáticos lo saltan
- [ ] T060 **Verificar en navegador que los tres formularios siguen funcionando** después de la trampa: agendar desde `#/agendar`, la cita rápida del inicio y el formulario de contacto. **El caso que importa es el normal** —el campo vacío—, porque es el que rompería a todos los clientes si la comprobación quedó al revés

#### Rama `006-tiempos-de-carga` (2026-08-15)

Medido contra producción antes y después, no estimado: **7.009 KB → 436 KB** en la primera
visita del inicio.

- [x] T061 **Compresión y caché en `Frontend/server.js`**, sin dependencias (`zlib` viene con Node). Gzip solo para tipos de texto —comprimir un WebP gasta CPU y no devuelve bytes— con `Vary: Accept-Encoding`, que no es opcional: sin esa cabecera una caché intermedia le puede servir una respuesta comprimida a un cliente que no la acepta. La política de caché es la parte delicada: `index.html` va **`no-cache`** porque si se cachea, el `?v=` nuevo no le llega nunca a nadie y el sitio queda congelado para siempre; los pedidos con `?v=` van `immutable`; el resto, un día
- [x] T062 **Las 15 imágenes PNG a WebP**, con `npx --yes sharp-cli@5` — herramienta de un solo uso, sin agregar dependencias al frontend. **14.451 KB → 857 KB**. Eran fotografías guardadas en el formato que no comprime fotografías. Los PNG se borraron del repositorio: quedan en el historial de git si alguna vez hacen falta, pero ya no viajan a Railway en cada build. Se agregó `loading="lazy"` a lo que está debajo del pliegue
- [ ] T063 **Verificar en navegador que el sitio se ve igual** después de la conversión: el hero del inicio, las tarjetas de vehículos, la página de servicios y los tres logos del pie. En una pestaña vieja hace falta Ctrl+F5

#### Rama `007-www-redirect` (2026-08-15)

- [x] T064 **`www` redirige al dominio raíz** con un 301 (`destinoSinWww()` en `Frontend/server.js`), y `Cache-Control: no-store` para no dejar clavada una redirección si algún día cambia. **Redirige en vez de servir el sitio** porque `CORS_ORIGIN` admite un solo origen: si el sitio respondiera en las dos direcciones, el API rechazaría todo lo que viniera de `www` —sin catálogo, sin agendamiento, sin panel— pero **solo para quienes escribieran `www`**. Una falla que le pasa a la mitad de las visitas y a la otra mitad no. Ya está desplegado y es inofensivo mientras el DNS no exista: nada puede llegar al servidor con ese `Host`
- [x] T065 **Agregar los dos registros de DNS de `www` en Namecheap.** **HECHA (2026-08-15)** por el propietario, que consiguió el acceso a la cuenta el mismo día en que la tarea se anotó como bloqueada. Son los que da Railway al agregar el dominio: un `CNAME` con host `www` apuntando a `0viwius0.up.railway.app`, y un `TXT` con host `_railway-verify.www`. **El valor del TXT hay que copiarlo con el botón de Railway**: en pantalla sale cortado, y pegado incompleto la verificación se queda en espera para siempre sin decir por qué. Si ya existe algún registro para `www` (Namecheap suele dejar uno de parking), hay que borrarlo primero o el CNAME choca

  **No sirve el "URL Redirect" de Namecheap**, que sería el camino corto: desde T058 el sitio manda HSTS con `includeSubDomains`, así que cualquier navegador que haya entrado al dominio raíz **exige HTTPS en `www`**, y ese servicio no entrega un certificado válido para el subdominio. El visitante vería una advertencia de seguridad, que asusta más que el error de hoy porque parece un ataque. El certificado lo tiene que emitir Railway
- [x] T066 **Verificar `www` en producción.** **HECHA (2026-08-15)**, contra el dominio real y no en local. Resuelve al CNAME de Railway (`0viwius0.up.railway.app`); el certificado está emitido y verifica sin objeciones (`ssl_verify_result: 0`, que es lo que confirma que no hizo falta el "URL Redirect" de Namecheap); y `https://www.cdavalledupar.com/` responde **301 a `https://cdavalledupar.com/`** y de ahí 200.

  **La ruta y la cadena de consulta se conservan**, comprobado con tres casos: `/tarifas`, `/assets/img/moto2t.webp` y `/?x=1` llegan los tres a su equivalente en el dominio raíz. El fragmento (`#/agendar`) no se pudo comprobar con `curl` y **no hace falta**: un fragmento nunca viaja al servidor, así que no hay nada que el redirect pueda perder — lo vuelve a pegar el navegador sobre la dirección nueva

#### Rama `008-indexacion-en-google` (2026-08-15)

El disparador fue una medición, no una corazonada: buscando `"cdavalledupar.com"` **entre
comillas** Google no devolvía el sitio ni una vez, mientras que `cdaguatapuri.com`,
`cdala44.com` y `cdadelcesar.com` sí salían para "CDA Valledupar revisión técnico-mecánica".
No es que el sitio ranqueara mal: **no estaba indexado**.

- [x] T067 **`robots.txt` y `sitemap.xml`**, que no existían (los dos daban 404). Lo que de verdad importa es la línea `Sitemap:`: sin enlaces entrantes y sin mapa, un dominio nuevo puede tardar meses en ser descubierto, o nunca. **No se bloquea ni un `.js` ni un `.css`**, a propósito: el sitio pinta todo con JavaScript y bloquear `/assets/` para "ahorrar rastreo" deja al rastreador viendo el `<main>` vacío — es el error clásico que deja un sitio entero fuera del índice
- [x] T068 **`server.js` aprende `.xml`.** Sin esa línea el sitemap se entregaba como `application/octet-stream` y Search Console lo rechaza sin leerlo. **Falla en silencio**: el archivo está, se descarga bien, y aun así "no se pudo obtener el sitemap"
- [x] T069 **`canonical`, `og:url`, `og:image`, título y descripción.** Sin `og:image` el enlace pegado en WhatsApp —que es por donde se comparte esto— sale como un recuadro gris. El `<title>` gastaba un tercio en "AutoCheck Pro", una marca sin volumen de búsqueda; ahora usa las palabras que la gente escribe
- [x] T070 **La ficha JSON-LD, que tenía `"url": "."`** —inválido—. Ahora lleva URL absoluta, imagen, horario y coordenadas. **Nada inventado**: el horario sale de `CDA.horario` y las coordenadas del mapa que la página de contacto ya muestra, así que heredan su estado (el horario sigue pendiente de ratificar, T059). Sin `priceRange`, sin `postalCode` y sin `sameAs`, que serían datos inventados de un negocio real. Tampoco hay `FAQPage`: desde 2023 Google solo muestra ese resultado enriquecido a sitios de salud y de gobierno
- [x] T071 **El Perfil de Empresa de Google.** Resultó que **ya existía y el propietario ya lo administraba**, con **137 opiniones y 4,3 estrellas** — un activo que no se compra y que pesa más que todo lo demás junto para un negocio local. El embed de `CDA.maps` en `data.js` apuntaba a esa misma ficha desde siempre (`cid=12238969371853820228`); nadie lo había notado. El propietario cargó el enlace al sitio y el botón de Reservas el 2026-08-15
- [x] T072 **Alinear el nombre del negocio.** La ficha dice "Centro de Diagnostico Automotriz Valledupar" y el JSON-LD decía "CDA de Valledupar": para Google son dos cadenas distintas, y el cruce entre ficha y sitio se apoya en que nombre, dirección y teléfono coincidan. Se corrigió **del lado del sitio** (`name` copiado carácter por carácter, `alternateName` para el nombre corto) y **nunca al revés**: editar el nombre del perfil para que "combine" es de las cosas por las que Google suspende una ficha, y esa ficha carga 137 opiniones
- [ ] T073 **Confirmar en una ventana de incógnito** que el botón "Sitio web" aparece en la ficha **pública**. La vista de administrador muestra cosas que el público no, y desde fuera no se puede comprobar: Google no expone ese dato sin API
- [ ] T074 **Search Console: verificar el dominio, mandar el sitemap y solicitar indexación.** **Verificar con la etiqueta HTML, no por DNS** — así no depende del acceso a Namecheap. **Bloqueada hasta desplegar**: la etiqueta tiene que estar publicada para que Google la lea

#### Rama `009-rutas-reales` (2026-08-15)

El sitio enrutaba por fragmento (`#/tarifas`). Funciona perfecto para una persona y es
invisible para un buscador: todo lo que va después del `#` **nunca viaja al servidor**, así
que Google pedía la raíz, descartaba el fragmento y concluía —con razón— que el sitio entero
era **una** página. Seis páginas de contenido compitiendo por una sola posición.

- [x] T075 **El router pasa a rutas reales** con la History API: `popstate` en vez de `hashchange`, y **un solo listener de clics sobre `document`** —no uno por `<a>`, porque `render()` destruye el DOM en cada cambio de ruta—. Deja pasar sin tocar todo lo que no es navegación interna: `tel:`, `mailto:`, enlaces externos, `//otro.com` (que empieza con `/` y **es externo**) y ctrl/cmd/clic del medio, que tienen que seguir abriendo en otra pestaña
- [x] T076 **Respaldo de la SPA en `server.js`.** Entrar directo a `/tarifas` es un pedido a un archivo que no existe; sin esto, cada enlace compartido, cada resultado de Google y cada F5 darían 404 y el router nunca llegaría a correr. **La condición es tener extensión o no**, y ahí está lo delicado: un `/assets/img/x.webp` inexistente **tiene** que seguir dando 404. Devolverle `index.html` a un `<img>` roto le responde 200 y HTML donde esperaba una imagen: no se ve nada, no hay error, y el problema se vuelve invisible
- [x] T077 **Todas las rutas de assets pasan a absolutas.** `./styles.css` se resuelve contra el **directorio** de la URL: en `/admin/vehiculos` apunta a `/admin/styles.css`. Es el error que deja el panel sin estilos ni scripts, y **solo en las rutas anidadas**
- [x] T078 **Título y descripción propios por ruta** (tabla `METADATOS` en `app.js`), más `canonical` y `og:` dinámicos. Seis URLs con el mismo `<title>` se leen como contenido duplicado: Google elige una y descarta el resto. **Ninguna descripción publica precios ni horarios**: un fragmento de Google queda cacheado semanas, y una cifra vieja ahí es una promesa comercial que el CDA no puede corregir a tiempo
- [x] T079 **El panel, fuera del índice.** Antes `#/admin` no existía para el servidor; hoy `/admin` sí. Lleva `Disallow` en `robots.txt` **y** `noindex` por el router, porque `robots.txt` impide **rastrear** pero no impide **indexar** una URL que alguien enlace. Ninguno de los dos protege el panel —eso lo hace el token contra el API—: evitan que "Iniciar sesión" salga como resultado de búsqueda del negocio
- [x] T080 **Los enlaces viejos con `#/` siguen llegando a donde iban.** Están pegados en conversaciones de WhatsApp, en el botón de Reservas del Perfil de Empresa y en marcadores. Sin `migrarRutaPorFragmento()` caían **en la home** después del despliegue: no una página rota, que al menos se nota, sino la página equivocada sin ningún aviso
- [ ] T081 **Verificar en navegador. BLOQUEA EL DESPLIEGUE** (principio IV, y no se puede simular). Navegar entre las seis páginas; **F5 en cada una**, que es donde se ve si el respaldo del servidor funciona; atrás y adelante; `/admin/vehiculos` **con estilos**; los enlaces del asistente; el menú en móvil; tocar un enlace a la página en la que ya se está; y entrar a `cdavalledupar.com/#/tarifas` y terminar en `/tarifas`
- [ ] T082 **Después de desplegar, apuntar el botón de Reservas a `/agendar`.** Hoy la ficha tiene que seguir en `https://cdavalledupar.com/#/agendar`, que es lo único que funciona con el código que hay en producción. Si se pone `/agendar` antes del despliegue, el botón de Reservas de Google lleva a un 404

### Pendientes que esta funcionalidad deja abiertos

**No bloquean nada** y no son parte de la definición de "terminado" de la 003. Están acá
—y no sueltos en un comentario o en una nota— porque un pendiente que no figura en la lista
de tareas es un pendiente que nadie va a encontrar buscando qué falta.

- [ ] T054 **Verificar la transferencia internacional de datos bajo la Ley 1581 de 2012.** La base guarda datos personales de clientes colombianos y vive en `us-east-1` (Virginia). La SIC mantiene una lista de países con nivel adecuado de protección; se eligió esa región por razones técnicas sabiendo que este punto quedaba sin confirmar (D4 de [research.md](./research.md)). **Ojo con el marco**: esto figuraba en las notas como "verificar antes de T001", y eso ya no es posible — el proyecto está creado y en producción. Si la respuesta obliga a Sudamérica, el remedio ya no es elegir otra región sino **migrar la base entera**, porque la región de un proyecto de Supabase no se cambia
- [x] T055 **Pasar la conexión a Postgres de `ssl: "require"` a verificación completa.** Hecho, pero **no como decía la tarea**: `ssl: "verify-full"` a secas habría dejado al CDA sin base. Supabase no usa una CA pública —firma con su propia raíz—, así que `verify-full`, que verifica contra las CA que trae Node, habría rechazado al servidor legítimo. Se comprobó contra el servidor real antes de tocar nada, con el saludo `SSLRequest` a mano y sin credenciales. La solución fue traer `Supabase Root 2021 CA` al repositorio ([certificadoSupabase.ts](../../Backend/src/basedatos/certificadoSupabase.ts)) y pasar `ssl: { ca, rejectUnauthorized: true }`, que verifica la cadena **y** el nombre del host. La raíz se bajó del sitio oficial de Supabase por HTTPS —canal independiente— y su huella coincide con la que presenta el pooler. **Vence el 26 de abril de 2031**, y una rotación de Supabase se manifiesta como un API que no conecta: el diagnóstico es `npx tsx scripts/verificar-tls.ts`

---

## Dependencies & Execution Order

### Dependencias entre fases

```
Phase 1 (Setup)
   ↓
Phase 2 (Foundational) ── BLOQUEANTE, nada empieza antes
   ↓
Phase 3 (US1) ──→ Phase 4 (US2) ──→ Phase 6 (US4)
   │                                     ↑
   └──→ Phase 5 (US3) ───────────────────┘  (independiente de US2)
   │
   └──→ Phase 7 (US5)  (depende solo de que exista POST /api/citas)
   ↓
Phase 8 (Polish)
```

### Dependencias entre historias

- **US2 depende de US1**: no se pueden manejar los fallos de un endpoint que no existe.
- **US4 depende de US1**: cambiar el estado de una cita necesita que haya citas.
- **US3 es independiente de todo lo demás**: solo necesita la fase 2. Se puede hacer en
  paralelo con US1 si hay dos personas.
- **US5 depende de US1**, no de US2 ni US4.

### Paralelismo

Dentro de la fase 2, T005 y T006 son archivos distintos, y T011 y T012 no dependen de nada
del backend. En la fase 3, T013/T014 (pruebas) y T015/T016 (validación e interfaz) se pueden
repartir; T017 en adelante es una cadena.

**El paralelismo real más grande es entre historias**: US3 no toca ningún archivo de US1.

### Reparto por dominio

La constitución exige que un cambio que cruce ambos lados se reparta, no se resuelva mezclado.

| Agente | Tareas |
|---|---|
| **webcda-backend** | T003, T005–T020, T026, T027, T031–T039, T043–T046, T049, T053 |
| **webcda-frontend** | T021–T025, T028–T030, T040–T042, T047 |
| **Sin agente** (consola de Supabase, Railway, Namecheap, verificación) | T001, T002, T004, T007, T034, T035, T048, T050, T051, T052 |

---

## Implementation Strategy

### MVP (solo la Historia 1)

Fases 1, 2 y 3 → **T001 a T025**. Al terminar, una cita agendada en el sitio aparece en el
panel del CDA. Eso solo ya arregla el problema por el que existe esta funcionalidad.

### Entrega incremental

**El corte importante está después de la fase 4.** Los tramos 1 a 4 (T001–T030) son el
corazón: las citas llegan **y** el cliente sabe la verdad sobre ellas. Si el trabajo se corta
ahí, el sistema queda arreglado. Si se corta antes, no: un sistema que guarda las citas pero
sigue confirmando cuando falla es tan malo como el de hoy y además engaña.

De la fase 5 en adelante son mejoras sobre un sistema que ya funciona, y cada una se puede
desplegar sola.

---

## Notes

**Lo que NO está acá y no es un olvido:**

- **Cupos por franja horaria (FR-028).** Sigue sin responder y depende del propietario del
  CDA. El modelo de datos guarda `fecha` y `hora` en columnas propias con su índice, así que
  cuando llegue la respuesta agregar el control será escribir una consulta y una validación,
  no rehacer el modelo ni migrar datos.

- **Ratificar los cuatro medios de pago** (PayU, MercadoPago, Efectivo, Transferencia) con el
  propietario. Están publicados en un sitio en producción y el sistema no cobra nada: si
  alguno no se acepta, es una promesa comercial falsa (principio I). Va junto con la
  ratificación pendiente de los seis servicios (T019 de la 001).

- **Editar los datos de una cita** (fecha, servicio, placa). Fuera de alcance por decisión de
  la especificación: solo se cambia el estado. Reprogramar se resuelve por teléfono.
