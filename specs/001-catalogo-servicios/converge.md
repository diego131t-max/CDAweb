# Converge: cierre del ciclo

**Date**: 2026-07-31 | **Feature**: Catálogo de servicios del CDA

Contraste del código realmente implementado contra spec, plan y tasks.

## Estado de los requisitos

Los once requisitos funcionales están implementados. Verificación ejecutada de forma
independiente al reporte de los agentes:

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` (Backend) | limpio |
| `npm test` (Backend) | 48/48 |
| `GET /api/servicios` | 200, los seis, única exclusión correcta |
| Filtrado por vehículo (FR-009) | motos 5 servicios sin blindaje; livianos y pesados 6 |
| Las 4 secciones de `#/admin` (FR-007) | las cuatro cargan — **antes reventaban las cuatro** |
| Servicio sin citas (FR-006) | aparece con conteo cero |
| Cita con servicio ajeno al catálogo | no rompe el panel |
| Servicio fuera del catálogo (FR-004) | rechazado |
| Blindaje + moto (FR-010) | rechazado |
| Citas sembradas (FR-011) | descartadas |
| Chatbot desde el catálogo (FR-001) | lista los seis |
| API caído | avisa y bloquea el agendamiento; no inventa lista |

## Trabajo restante

Las siguientes tareas quedan **anexadas a tasks.md**. Ninguna estaba comprometida en el
alcance de esta funcionalidad; se registran para que no se pierdan.

### T018 — Prueba en navegador real (prioridad alta)

La verificación se hizo con una simulación en Node que carga los scripts en el mismo orden
que `index.html` y ejercita las funciones contra el API vivo. **Eso no es un navegador.**

Sin ejercitar: el `change` listener del `<select>` de vehículo que rearma la lista de
servicios, el botón de reintentar la carga del catálogo, y el render visual del aviso
`.form-alert`. Son justamente las interacciones de DOM que la simulación no puede cubrir.

El principio IV de la constitución es explícito: en el frontend, la única verdad es el
navegador. **Este requisito sigue sin cumplirse.** El agente encargado se colgó exactamente
en ese paso.

### T019 — Ratificar el catálogo con el propietario (prioridad alta)

Los seis servicios se adoptaron de lo que el sitio ya publica, no de una confirmación del
CDA. Riesgo declarado desde `specify` y sostenido en los tres artefactos.

Dos observaciones del agente de backend para esa conversación:

- **"Inspección de Luces y Frenos"** se superpone con lo que la revisión técnico-mecánica
  ya incluye: la página de servicios lista frenos y luces como puntos internos de esa
  revisión. Puede ser un servicio suelto real o una redundancia del texto del chatbot.
- **"Certificado de Blindaje"** es un certificado, no una inspección, y en Colombia no suele
  ser un trámite de CDA. Es además el único con exclusión: si el propietario lo quita,
  **FR-009 se queda sin excepciones** y el filtrado por vehículo pierde su único caso.

### T020 — Validación de servicio del lado del servidor

FR-004 y FR-010 se validan solo en el cliente, porque las citas siguen en `localStorage` y
el API no las recibe. Limitación declarada en plan.md, no un descuido. Se resuelve cuando
las citas migren al API — la funcionalidad siguiente.

### T021 — Rate limiting en `POST /api/mensajes`

Detectado al implementar los mensajes de contacto: el endpoint es público y escribe a disco
sin límite. Fuera del alcance de esta funcionalidad, pero necesario antes de exponer el API
fuera de localhost.

### T022 — Versionar el script de verificación

`checklists/calidad.md` (CHK019) referencia `check-admin.js`, que vive en el scratchpad de
la sesión y no está versionado. Si la verificación va a repetirse, el script debería entrar
al repositorio.

## Cambio no planificado, aceptado

`Frontend/styles.css` ganó la clase `.form-alert` (24 líneas), que no figuraba en ninguna
tarea. Es correcto: T010 y T011 exigen mostrar avisos que bloquean el formulario y no
existía ninguna clase para eso. Usa las variables de color ya definidas y no duplica nada.

## Veredicto

**La funcionalidad está completa y verificada salvo T018.** El bug que originó todo esto
—las cuatro secciones del panel caídas— está muerto y comprobado por contraste directo
contra el fallo original.

La deuda real es la prueba en navegador. Todo lo demás son cosas que esta funcionalidad
destapó y decidió no arrastrar.
