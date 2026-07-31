---

description: "Task list for feature implementation"
---

# Tasks: Catálogo de servicios del CDA

**Input**: Design documents from `/specs/001-catalogo-servicios/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories)

**Tests**: incluidos solo para la regla de exclusión servicio/vehículo. El principio IV de
la constitución exige tests para lógica con reglas de negocio; el resto se valida con
`tsc --noEmit` y prueba en navegador.

**Organization**: agrupadas por historia de usuario, para poder parar en cualquier
checkpoint con algo funcionando.

## Format: `[ID] [P?] [Story] [Agente] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias)
- **[Agente]**: `BACK` → subagente `webcda-backend` · `FRONT` → subagente `webcda-frontend`

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: el catálogo tiene que existir y ser consumible antes de que cualquier historia
pueda tocarse.

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta terminar esta fase.

- [ ] T001 [P] [BACK] Definir `Servicio` y `TipoVehiculo` en `Backend/src/tipos/servicio.ts`,
      según el modelo de datos de plan.md (modelado por exclusión, no por inclusión)
- [ ] T002 [BACK] Definir la interfaz `RepositorioServicios` en
      `Backend/src/repositorios/repositorioServicios.ts`, con firmas asíncronas, siguiendo
      el patrón documentado en `repositorioMensajes.ts` (depende de T001)
- [ ] T003 [BACK] Implementar `RepositorioServiciosEstatico` en
      `Backend/src/repositorios/repositorioServiciosEstatico.ts` con los seis servicios de
      FR-008 como constante versionada. **Los nombres son exactamente los que ya publica el
      sitio; no inventar ni reformular ninguno** (depende de T002)
- [ ] T004 [BACK] Tests de la regla de exclusión de FR-009: blindaje no disponible para
      Motos 2T ni 4T; los seis disponibles para livianos y pesados; ningún otro servicio
      excluido (depende de T003)
- [ ] T005 [BACK] Exponer `GET /api/servicios` en `Backend/src/rutas/servicios.ts`, público
      y sin autenticación, devolviendo el catálogo completo (depende de T002)
- [ ] T006 [BACK] Registrar el repositorio en `Backend/src/dependencias.ts` y montar la ruta
      en `Backend/src/server.ts` (depende de T003, T005)
- [ ] T007 [FRONT] Cargar el catálogo una sola vez al arrancar, **antes del primer render**,
      en `Frontend/app.js`; guardarlo en un global y manejar el fallo de red sin dejar la
      página en blanco (depende de T006)

**Checkpoint**: el catálogo existe en el API y el frontend lo tiene disponible.

---

## Phase 2: User Story 1 - El cliente elige el servicio que necesita (P1) 🎯 MVP

**Goal**: que el cliente pueda elegir, al agendar, cuál de los servicios del CDA necesita.

**Independent Test**: agendar una cita eligiendo un servicio distinto del que traía el
formulario y verificar que quedó registrada con ese servicio.

- [ ] T008 [FRONT] Reescribir `serviceOptions()` en `Frontend/utils.js` para que genere las
      opciones desde el catálogo cargado y **filtre por el tipo de vehículo recibido**.
      Hoy es código muerto que referencia un global inexistente (depende de T007)
- [ ] T009 [FRONT] Reemplazar el input oculto de servicio por un `<select>` real en el paso 2
      de `Frontend/pages/schedule.js`, alimentado por `serviceOptions()` con el vehículo
      seleccionado (depende de T008)
- [ ] T010 [FRONT] Impedir avanzar con una combinación inválida de servicio y vehículo en
      `Frontend/pages/schedule.js`, incluido el caso de cambiar el vehículo después de haber
      elegido el servicio (depende de T009)
- [ ] T010b [FRONT] Validar antes de confirmar que el servicio de la cita **existe en el
      catálogo** en `Frontend/pages/schedule.js`, no solo que la combinación con el vehículo
      sea válida. Cubre FR-004, que T010 no alcanza (depende de T009)
- [ ] T011 [FRONT] Bloquear la confirmación con un mensaje claro en español si el catálogo no
      pudo cargarse, sin permitir agendar sin servicio (depende de T007)

**Checkpoint**: US1 funciona sola. El panel todavía puede estar roto; no importa para esta
historia.

---

## Phase 3: User Story 2 - El personal ve y analiza las citas por servicio (P2)

**Goal**: que el panel de administración abra y muestre el conteo de citas por servicio.

**Independent Test**: abrir las cuatro secciones del panel y verificar que todas cargan y
que el reporte agrupa por servicio.

- [ ] T012 [FRONT] Hacer que `reportsView()` de `Frontend/pages/admin.js` construya el
      reporte desde el catálogo cargado en vez del global `servicios` inexistente. **Acá
      desaparece el `ReferenceError` que hoy tumba las cuatro secciones** (depende de T007)
- [ ] T013 [FRONT] Asegurar que una cita con un servicio ausente del catálogo se muestre y se
      cuente sin romper el panel, y que un servicio sin citas aparezca en cero
      (depende de T012)

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 4: User Story 3 - El sitio nunca se contradice sobre lo que ofrece (P3)

**Goal**: que exista una sola lista de servicios en todo el sitio.

**Independent Test**: comparar lo que responde el asistente del sitio con la lista del
formulario de agendamiento.

- [ ] T014 [FRONT] Eliminar la lista de servicios codificada dentro de
      `chatbotPrompts.servicios` en `Frontend/data.js` y hacer que la respuesta se arme
      desde el catálogo cargado (depende de T007)
- [ ] T015 [FRONT] Descartar las citas sembradas de ejemplo en `ensureSeed()` de
      `Frontend/utils.js`, según FR-011

**Checkpoint**: las tres historias funcionan.

---

## Phase 5: Polish & Cross-Cutting

- [ ] T016 [FRONT] Incrementar el `?v=` de `Frontend/index.html` para todos los archivos
      modificados (sin esto el navegador sirve las versiones viejas)
- [ ] T017 Verificación de extremo a extremo contra
      [checklists/calidad.md](./checklists/calidad.md): `tsc --noEmit`, `npm test`, recorrido
      manual del sitio y contraste con `check-admin.js`, que debe dejar de reproducir el fallo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Fase 1 (Foundational)**: bloquea todo. Sin catálogo no hay nada que consumir.
- **Fases 2, 3 y 4**: dependen de la Fase 1. Entre ellas son independientes y podrían
  hacerse en paralelo o en orden de prioridad P1 → P2 → P3.
- **Fase 5**: depende de las historias que se decidan implementar.

### Reparto entre agentes

La Fase 1 empieza siendo íntegramente de `webcda-backend` (T001-T006) y termina con la
primera tarea de `webcda-frontend` (T007), que es la bisagra: hasta que el frontend no
tenga el catálogo cargado, ninguna historia puede avanzar.

De la Fase 2 en adelante **todo es de `webcda-frontend`**. Las historias 2, 3 y 4 no
requieren más trabajo de backend.

### Oportunidades de paralelismo

- T001 puede arrancar de inmediato.
- T004 (tests) y T005 (ruta) son paralelizables entre sí: dependen de piezas distintas.
- Una vez cerrada la Fase 1, las Fases 2, 3 y 4 son independientes entre sí y podrían
  repartirse — aunque las tres tocan archivos del frontend, y T012 y T014 no comparten
  archivo con T009, así que el riesgo de conflicto es bajo pero no nulo.

---

## Implementation Strategy

### MVP primero

1. Fase 1 completa (el catálogo existe y se consume).
2. Fase 2 → **PARAR Y VALIDAR**: agendar una cita eligiendo servicio.
3. Con eso ya hay valor entregado aunque el panel siga roto.

### Entrega incremental

Fase 1 → Fase 2 (el cliente elige) → Fase 3 (el panel revive) → Fase 4 (deja de haber
contradicciones) → Fase 5 (verificación).

La Fase 3 es la que arregla el bug que originó toda esta funcionalidad, pero va después de
la Fase 2 a propósito: sin que los clientes puedan elegir servicio, el reporte del panel
mostraría todas las citas agrupadas en un único valor, que es informativamente inútil.

---

## Notes

- Cada tarea va al agente de su dominio; no mezclar (principio del flujo de desarrollo de
  la constitución).
- El fix del `ReferenceError` **no es una tarea propia**: cae solo en T012 como consecuencia
  de que el catálogo exista.
- **No inventar nombres de servicio** en T003. Es el principio I de la constitución y el
  riesgo abierto de esta funcionalidad.
- Recordar T016: es el error más frecuente en este frontend y hace parecer que nada funcionó.
- **Cambio en el modelo de despliegue (hallazgo H3 de [analysis.md](./analysis.md)):** hasta
  ahora el frontend era completamente estático y bastaba con `node Frontend/server.js`. Al
  mover el catálogo al API, **agendar deja de funcionar si el API está caído** y desarrollar
  pasa a requerir dos procesos. T011 cubre el comportamiento ante la falla, pero conviene
  tenerlo presente: es un cambio en cómo se corre el proyecto, no un detalle interno.
