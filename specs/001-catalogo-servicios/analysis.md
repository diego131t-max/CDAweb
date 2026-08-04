# Analysis: consistencia entre spec, plan y tasks

**Date**: 2026-08-04 | **Feature**: [spec.md](./spec.md) · [plan.md](./plan.md) · [tasks.md](./tasks.md)

Revisión no destructiva previa a `/speckit-implement`.

## Cobertura de requisitos funcionales

| Req | Cubierto por | Estado |
|---|---|---|
| FR-001 catálogo único | T003, T014 | ✅ |
| FR-002 el cliente elige del catálogo | T008, T009 | ✅ |
| FR-003 la cita registra el servicio elegido | T009 | ✅ |
| FR-004 rechazar servicio fuera del catálogo | — | ⚠️ Ver H2 |
| FR-005 el panel muestra el servicio de cada cita | — | ⚠️ Ver H1 |
| FR-006 conteo por servicio, incluidos los de cero | T012, T013 | ✅ |
| FR-007 el panel carga sus cuatro secciones | T012 | ✅ |
| FR-008 los seis servicios | T003 | ✅ |
| FR-009 exclusión blindaje/motos | T003, T004, T008 | ✅ |
| FR-010 rechazar combinación inválida | T010 | ✅ (con la limitación ya declarada) |
| FR-011 descartar citas sembradas | T015 | ✅ |

Las tres historias de usuario tienen fase propia (US1→Fase 2, US2→Fase 3, US3→Fase 4) y
ninguna tarea queda sin trazabilidad a un requisito.

## Hallazgos

### H1 — FR-005 no tiene tarea propia (severidad: baja)

El panel ya renderiza `item.service` en la tabla de reservas, así que el requisito se
cumple **de forma incidental** en cuanto T012 hace que el panel cargue. No hace falta una
tarea nueva, pero conviene dejarlo dicho: si alguien reescribe esa tabla sin saberlo, pierde
un requisito sin que ninguna tarea lo señale.

**Acción**: ninguna en el código. Se documenta acá la trazabilidad implícita.

### H2 — FR-004 no tiene tarea que lo cubra (severidad: media)

FR-004 exige rechazar una cita cuyo servicio **no pertenezca al catálogo**. T010 cubre el
caso vecino pero distinto: la combinación inválida de servicio y vehículo (FR-010). Nadie
valida que el servicio exista.

En la práctica el `<select>` solo ofrece servicios del catálogo, así que el camino normal
está cubierto por construcción. El hueco aparece con datos manipulados o con citas viejas.

**Acción**: se agrega T010b a tasks.md.

### H3 — El sitio pasa a depender del API para poder agendar (severidad: media)

Consecuencia arquitectónica real que ni la spec ni el plan enuncian de frente: hasta hoy el
frontend era **completamente estático** y funcionaba con solo abrir `server.js`. Al mover el
catálogo al API, agendar deja de funcionar si el API está caído, y aparece un segundo
proceso obligatorio para desarrollar.

El plan sí resuelve el comportamiento ante la falla (T011: mensaje claro, no dejar agendar
sin servicio), así que no hay hueco funcional. Lo que faltaba era decirlo: **es un cambio en
el modelo de despliegue del proyecto**, no un detalle de implementación.

**Acción**: se documenta en tasks.md como nota de operación.

### H4 — CHK019 depende de un archivo temporal (severidad: baja)

`checklists/calidad.md` referencia `check-admin.js`, que vive en el directorio scratchpad de
la sesión y no está versionado: puede no existir cuando alguien corra la verificación.

**Acción**: ninguna por ahora. El ítem sigue siendo válido — reproducir el fallo es trivial
abriendo `#/admin`. Si se quiere permanente, el script debería moverse al repositorio.

## Consistencia con la constitución

Sin contradicciones. Los cinco principios están reflejados en el Constitution Check de
plan.md y trazados a ítems concretos de `checklists/calidad.md` (CHK024–CHK030).

El riesgo abierto — los seis servicios pendientes de ratificación por el propietario —
aparece declarado de forma consistente en los tres artefactos (spec Assumptions, plan
Constitution Check, checklist Notes). No hay lugar donde se presente como dato confirmado.

## Veredicto

**Listo para `/speckit-implement`**, con una tarea agregada (T010b) y dos notas
documentadas. Ningún hallazgo bloquea el inicio de la implementación.
