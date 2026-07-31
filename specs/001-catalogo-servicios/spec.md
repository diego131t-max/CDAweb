# Feature Specification: Catálogo de servicios del CDA

**Feature Branch**: `001-catalogo-servicios-del-cda`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Catálogo de servicios del CDA. Hoy el cliente que agenda una cita no puede elegir qué servicio quiere: el formulario fija un único valor oculto, así que todas las citas quedan registradas con el mismo servicio. El personal del CDA, por su parte, no puede ver el panel de administración en absoluto porque falla al intentar mostrar el reporte de citas por servicio, que depende de una lista de servicios que nunca existió como dato. El proyecto menciona servicios en tres lugares distintos y ninguno coincide con los otros. Se necesita que el catálogo de servicios exista como un dato único y confiable del sistema."

## Clarifications

### Session 2026-07-31

- Q: ¿Cuáles son los servicios que el CDA presta realmente? (FR-008) → A: Los seis que el
  sitio ya publica: revisión técnico-mecánica, revisión de gases, inspección de luces y
  frenos, peritaje vehicular, certificado de blindaje y diagnóstico electrónico. Quedan
  adoptados por estar ya publicados en el sitio; **pendiente de ratificar con el
  propietario** antes de salir a producción.
- Q: ¿Todos los servicios aplican a los cuatro tipos de vehículo? (FR-009) → A: No.
  **Certificado de blindaje no aplica a motos** (2T ni 4T); es la única exclusión. Los
  vehículos pesados no tienen exclusiones.
- Q: ¿Qué hacemos con las citas ya registradas cuyo servicio no figure en el catálogo?
  (FR-010) → A: Las citas actuales son datos de prueba sembrados, no reales: se descartan
  y el catálogo arranca limpio.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El cliente elige el servicio que necesita (Priority: P1)

Una persona entra al sitio a agendar una revisión. Además de sus datos, su vehículo y la
fecha, elige de una lista cuál de los servicios del CDA necesita. Al confirmar, su cita
queda registrada con ese servicio, y el resumen previo a confirmar se lo muestra.

**Why this priority**: es el valor central de la funcionalidad. Hoy el cliente no puede
expresar qué necesita, así que el CDA recibe citas sin saber a qué viene cada persona y
debe averiguarlo por teléfono o el día de la visita. Sin esto, el resto no tiene sentido.

**Independent Test**: se agenda una cita completa eligiendo un servicio distinto del que
traía el formulario y se verifica que quedó registrada con el servicio elegido. Entrega
valor por sí sola aunque el panel de administración siga sin funcionar.

**Acceptance Scenarios**:

1. **Given** un cliente en el paso de vehículo y servicio del agendamiento, **When** abre
   la lista de servicios, **Then** ve los servicios que el CDA presta y puede seleccionar
   uno.
2. **Given** un cliente que eligió un servicio, **When** llega a la pantalla de
   confirmación, **Then** el resumen muestra el servicio que eligió.
3. **Given** un cliente que confirma la cita, **When** la cita queda registrada,
   **Then** conserva el servicio elegido y no un valor fijo.
4. **Given** un cliente que eligió una moto (2T o 4T), **When** abre la lista de
   servicios, **Then** no ve certificado de blindaje entre las opciones.
5. **Given** un cliente que cambia el tipo de vehículo después de elegir un servicio que
   no aplica al nuevo tipo, **When** continúa, **Then** el sistema no le permite avanzar
   con esa combinación.

---

### User Story 2 - El personal ve y analiza las citas por servicio (Priority: P2)

El personal del CDA abre el panel de administración para ver las citas agendadas. Puede
ver qué servicio pidió cada cliente y, en el reporte, cuántas citas hay por cada servicio.

**Why this priority**: hoy el panel **no abre en absoluto** — falla en las cuatro
secciones. Esto desbloquea una herramienta que el personal no puede usar. Va después de
P1 porque, sin que los clientes puedan elegir servicio, el reporte mostraría todas las
citas agrupadas en un solo valor.

**Independent Test**: se abre el panel y se recorren sus cuatro secciones verificando que
todas cargan y que el reporte muestra el conteo por servicio.

**Acceptance Scenarios**:

1. **Given** el personal autenticado en el panel, **When** abre cualquiera de sus
   secciones, **Then** la sección carga sin errores.
2. **Given** citas registradas con distintos servicios, **When** el personal abre el
   reporte, **Then** ve cuántas citas corresponden a cada servicio del catálogo.
3. **Given** un servicio del catálogo sin ninguna cita, **When** el personal abre el
   reporte, **Then** ese servicio aparece con conteo cero, no desaparece.

---

### User Story 3 - El sitio nunca se contradice sobre lo que ofrece (Priority: P3)

Un visitante que pregunta al asistente del sitio qué servicios hay, y luego va a agendar,
ve la misma lista en ambos lugares.

**Why this priority**: hoy el sitio menciona servicios en tres lugares con contenidos
distintos, lo que genera desconfianza y consultas evitables. Es importante pero no
bloquea a nadie, por eso va tercero.

**Independent Test**: se comparan los servicios que ofrece el asistente del sitio con los
del formulario de agendamiento y se verifica que coinciden.

**Acceptance Scenarios**:

1. **Given** un visitante que consulta los servicios por cualquier vía del sitio,
   **When** compara esa información con la lista del agendamiento, **Then** ambas
   coinciden.
2. **Given** que se agrega o se quita un servicio del catálogo, **When** el visitante
   recorre el sitio, **Then** el cambio se refleja en todos los lugares que los
   mencionan.

---

### Edge Cases

- ¿Qué pasa si el catálogo de servicios no está disponible al momento de agendar? El
  cliente no debe quedar bloqueado sin explicación ni poder enviar una cita sin servicio.
- ¿Qué pasa si una cita quedó registrada con un servicio que luego sale del catálogo? El
  panel debe seguir mostrándola sin fallar y contarla aparte, no romperse.
- ¿Qué pasa si el cliente elige un servicio y después cambia el tipo de vehículo a uno al
  que ese servicio no aplica? No debe poder confirmar esa combinación.
- ¿Qué pasa si el catálogo queda vacío? El agendamiento no debe ofrecer una lista vacía
  sin explicación.
- ¿Qué pasa si un cliente manipula el envío para mandar un servicio inexistente? La cita
  no debe registrarse con un servicio fuera del catálogo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mantener el catálogo de servicios como un dato único, del
  que se alimenten todos los lugares del sitio que los mencionen.
- **FR-002**: El sistema MUST permitir al cliente elegir uno de los servicios del catálogo
  durante el agendamiento.
- **FR-003**: El sistema MUST registrar cada cita con el servicio que eligió el cliente.
- **FR-004**: El sistema MUST rechazar una cita cuyo servicio no pertenezca al catálogo.
- **FR-005**: El sistema MUST mostrar al personal el servicio solicitado en cada cita.
- **FR-006**: El sistema MUST mostrar al personal el conteo de citas por cada servicio del
  catálogo, incluyendo los servicios sin citas.
- **FR-007**: El panel de administración MUST cargar todas sus secciones sin errores,
  incluso si existen citas con servicios que ya no figuran en el catálogo.
- **FR-008**: El catálogo MUST contener exactamente estos seis servicios: revisión
  técnico-mecánica, revisión de gases, inspección de luces y frenos, peritaje vehicular,
  certificado de blindaje y diagnóstico electrónico.
- **FR-009**: El sistema MUST ofrecer al cliente únicamente los servicios aplicables al
  tipo de vehículo que eligió. **Certificado de blindaje NO aplica a motos** (2T ni 4T);
  no existen otras exclusiones, y los vehículos pesados admiten los seis servicios.
- **FR-010**: El sistema MUST rechazar una cita cuya combinación de servicio y tipo de
  vehículo no sea válida, aunque el servicio exista en el catálogo.
- **FR-011**: Los datos de citas sembrados como ejemplo MUST descartarse: el catálogo
  entra en vigencia sin arrastrar citas previas.

### Key Entities

- **Servicio**: un trabajo que el CDA presta y que un cliente puede solicitar. Se
  identifica de forma estable, tiene un nombre visible para el cliente y declara a qué
  tipos de vehículo aplica. Es la unidad del catálogo.
- **Catálogo de servicios**: el conjunto completo de servicios vigentes. Es la única fuente
  de verdad sobre lo que el CDA ofrece.
- **Cita**: la reserva de un cliente, que ya existe en el sistema. Pasa a referirse a un
  servicio del catálogo en lugar de contener un texto fijo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cliente puede agendar una cita eligiendo el servicio que necesita, sin
  ayuda ni consulta previa, completando el proceso en menos de 3 minutos.
- **SC-002**: El 100% de las secciones del panel de administración cargan sin errores;
  hoy fallan las cuatro.
- **SC-003**: El 100% de las citas nuevas quedan registradas con el servicio que eligió el
  cliente; hoy el 100% queda con el mismo valor fijo.
- **SC-004**: La lista de servicios que ve el cliente es idéntica en todos los lugares del
  sitio donde se mencionan; hoy hay tres listas distintas.
- **SC-005**: El personal puede saber cuántas citas hay por cada servicio sin revisar las
  citas una por una.

## Assumptions

- ⚠️ Los seis servicios adoptados provienen de lo que **el sitio ya publica** en su
  asistente. Se toman como válidos por estar ya comprometidos públicamente, pero
  **quedan pendientes de ratificación por el propietario del CDA** antes de salir a
  producción. Si el propietario corrige la lista, cambia FR-008 y la exclusión de FR-009.
- El catálogo de servicios es **de solo lectura para el cliente**; administrarlo desde el
  panel queda fuera del alcance de esta funcionalidad.
- El **precio por servicio queda fuera de alcance**. El sitio ya publica tarifas por tipo
  de vehículo; unificar precios por servicio es una decisión de negocio aparte que
  requiere confirmar tarifas con el propietario.
- Los **puntos de inspección** que el sitio ya describe (carrocería, frenos, gases,
  suspensión, etc.) NO son servicios: describen qué se revisa dentro de una revisión. Esta
  funcionalidad no los modifica.
- El servicio de una cita se elige **una sola vez, al agendar**; cambiarlo después queda
  fuera de alcance.
- El catálogo cambia con muy poca frecuencia (del orden de una vez al año), por lo que no
  se requiere que los cambios se reflejen de forma inmediata sin intervención.
