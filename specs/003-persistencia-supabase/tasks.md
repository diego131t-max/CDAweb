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

- [x] T056 **Borrar citas desde el panel** (FR-029, 2026-08-14). `DELETE /api/citas/:id` detrás de credencial y del limitador, `borrar()` en la interfaz de repositorio y su implementación en Postgres, botón en `admin.js` con confirmación, y estilo propio para la única acción irreversible del panel. **Solo borra citas canceladas**, y la regla se aplica en el repositorio dentro de una transacción con `for update`: comprobar y borrar en dos consultas sueltas dejaría que un cambio de estado se cuele en el medio. **Revierte parcialmente lo que decía `contracts/citas.md`** ("no existe y no se agrega"), y el porqué está escrito ahí. 7 pruebas nuevas: 115/115
- [ ] T057 **Verificar el borrado en navegador**: cancelar una cita, ver aparecer el botón Borrar, confirmarlo, y comprobar que desaparece y sigue sin estar después de recargar. Probar también que en una cita pendiente el botón **no** aparece

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
