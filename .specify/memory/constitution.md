<!--
Sync Impact Report
==================
Cambio de versión: (plantilla sin ratificar) → 1.0.0
Motivo del bump: MAJOR inicial. Primera ratificación: se reemplazan todos los
placeholders de la plantilla por principios concretos del proyecto.

Principios definidos (los 5 provistos por el propietario del proyecto):
  - [PRINCIPLE_1_NAME] → I. Los datos del negocio no se inventan (NO NEGOCIABLE)
  - [PRINCIPLE_2_NAME] → II. Los datos personales fallan cerrado (NO NEGOCIABLE)
  - [PRINCIPLE_3_NAME] → III. La persistencia va detrás de una interfaz
  - [PRINCIPLE_4_NAME] → IV. Cada lado se valida como puede
  - [PRINCIPLE_5_NAME] → V. Todo de cara al usuario, en español

Secciones añadidas:
  - [SECTION_2_NAME] → Restricciones Técnicas
  - [SECTION_3_NAME] → Flujo de Desarrollo
  - [GOVERNANCE_RULES] → Gobernanza

Sin secciones eliminadas.

TODO diferidos: ninguno.
-->

# Constitución de webCDA

Sitio y sistema de agendamiento del Centro de Diagnóstico Automotor de Valledupar.
Estas reglas gobiernan cualquier cambio al proyecto y prevalecen sobre preferencias
individuales o costumbres heredadas del código existente.

## Core Principles

### I. Los datos del negocio no se inventan (NO NEGOCIABLE)

Precios, servicios, horarios, requisitos y cualquier otro dato del negocio **DEBEN**
provenir del propietario del CDA o de una fuente ya confirmada dentro del repositorio.
Está **PROHIBIDO** estimarlos, deducirlos de la competencia o completarlos con valores
plausibles.

Ante un dato faltante, el comportamiento obligatorio es dejarlo explícitamente vacío
("Consultar", "Por confirmar") y señalarlo, nunca rellenarlo.

*Razón:* esto es un negocio real que atiende clientes. Un precio inventado en el sitio
es una promesa comercial falsa y expone al CDA frente a quien la reclame. Un dato
faltante y visible cuesta una consulta; uno inventado cuesta la credibilidad.

### II. Los datos personales fallan cerrado (NO NEGOCIABLE)

El sistema maneja nombre, teléfono, correo y placa de clientes. Todo endpoint o vista
que lea o modifique esos datos **DEBE** exigir autenticación.

Cuando el mecanismo de autenticación no esté configurado o no pueda verificarse, la
respuesta **DEBE** ser un error (fallar cerrado). Está **PROHIBIDO** degradar a acceso
abierto, exponer el recurso "temporalmente" o dejarlo público con un comentario
pendiente. Los datos personales **NO DEBEN** aparecer en logs ni en mensajes de error.

Solo dos operaciones son públicas: crear una cita y enviar un mensaje de contacto.

*Razón:* el panel de administración estuvo abierto a cualquiera que escribiera la URL.
El modo de falla por defecto decide si un descuido se convierte en una filtración.

### III. La persistencia va detrás de una interfaz

El acceso a datos **DEBE** definirse como una interfaz de repositorio con firmas
asíncronas. Los manejadores HTTP **NO DEBEN** importar el mecanismo de almacenamiento
ni conocer su implementación. La instanciación concreta vive en un único punto de
composición.

*Razón:* el almacenamiento actual en archivo JSON es provisional; la migración a
Postgres/Supabase está pendiente. Si los manejadores tocan el almacenamiento directo,
esa migración obliga a reescribirlos. Las firmas son asíncronas desde el inicio para
que el cambio no propague `async` por todo el código.

### IV. Cada lado se valida como puede

El frontend no tiene compilación ni pruebas automatizadas: su validación **DEBE** ser
la ejecución real en el navegador, probando la ruta afectada y la navegación entre
rutas.

El backend **DEBE** pasar `npx tsc --noEmit` y `npm test` antes de darse por terminado.
La lógica con reglas de negocio (cupos, estados, autenticación, validación)
**DEBE** tener pruebas.

Ninguna tarea se declara completa sin haber ejecutado la verificación que le
corresponde. Está **PROHIBIDO** reportar como terminado algo que solo se leyó.

*Razón:* los dos lados tienen redes de seguridad distintas y aplicar el criterio del
uno al otro deja huecos. En el frontend, el compilador no existe: solo el navegador
dice la verdad.

### V. Todo de cara al usuario, en español

Los textos visibles del sitio, los mensajes de error del API y los comentarios del
código **DEBEN** estar en español, tuteando al usuario. Los errores de validación
**DEBEN** indicar qué campo falló y por qué, en lenguaje que entienda un cliente.

*Razón:* los usuarios son clientes de un CDA en Colombia. Un error en inglés o un
código técnico no le sirve a quien intenta agendar una revisión.

## Restricciones Técnicas

**Frontend (`Frontend/`)** — SPA en JavaScript sin compilación, sin npm y sin módulos.
Todo vive en ámbito global y se carga por etiquetas `<script>` en orden de dependencia.
**NO DEBE** introducirse sintaxis de módulos, bundlers ni dependencias que requieran
compilación. Al modificar un archivo **DEBE** subirse el parámetro `?v=` de caché.

**Backend (`Backend/`)** — API en Express y TypeScript con `strict` activado. **NO DEBE**
usarse `any` sin justificación escrita. La configuración se lee del entorno; los
secretos viven en `.env`, que **NUNCA** se versiona.

**Datos de clientes** — cualquier archivo que los contenga **DEBE** estar en `.gitignore`.

## Flujo de Desarrollo

El trabajo sigue el ciclo Spec-Driven Development de Spec Kit: la especificación es la
fuente de verdad y precede al código.

Las tareas se delegan a los subagentes especializados según su dominio: `webcda-frontend`
para la SPA, `webcda-backend` para el API. Un cambio que cruce ambos lados **DEBE**
repartirse por dominio, no resolverse mezclado.

Cada fase del ciclo queda registrada en su propio commit, de modo que el proceso sea
auditable y reversible por etapas.

## Governance

Esta constitución prevalece sobre cualquier otra práctica del proyecto. El código
existente que la contradiga se considera deuda a corregir, no precedente a imitar.

**Enmiendas** — toda modificación **DEBE** quedar documentada en el Sync Impact Report
de este archivo, con su justificación y el cambio de versión correspondiente.

**Versionado** — semántico. MAJOR para remover o redefinir un principio de forma
incompatible; MINOR para añadir un principio o ampliar materialmente una guía; PATCH
para aclaraciones y correcciones sin cambio de significado.

**Cumplimiento** — toda revisión **DEBE** verificar el apego a estos principios. Los dos
principios marcados NO NEGOCIABLE no admiten excepción por urgencia ni por conveniencia:
ante la duda, se detiene el trabajo y se consulta. El resto admite excepción solo si
queda justificada por escrito en la especificación de la funcionalidad.

**Version**: 1.0.0 | **Ratified**: 2026-07-31 | **Last Amended**: 2026-07-31
