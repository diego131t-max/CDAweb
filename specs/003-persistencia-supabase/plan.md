# Implementation Plan: Persistencia central y citas que llegan al CDA

**Branch**: `003-persistencia-supabase` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-persistencia-supabase/spec.md`

## Summary

Sacar las citas del navegador del cliente y llevarlas a una base Postgres en Supabase, junto
con los mensajes de contacto que hoy viven en un archivo JSON sobre un volumen de Railway.
Agregar los tres endpoints que las citas nunca tuvieron —crear, listar, cambiar estado—,
validar el servicio pedido del lado del servidor, y avisarle al cliente por correo sin que
ese aviso pueda arruinar el registro de la cita.

**El grueso del trabajo es de plomería, no de diseño**, y eso es a propósito: el principio
III se cobró por adelantado. La interfaz de repositorio existe, todas sus firmas ya son
asíncronas aunque el JSON sea síncrono, y `dependencias.ts` es el único lugar donde se elige
la implementación. Migrar los mensajes es escribir `RepositorioMensajesPostgres` y cambiar
una línea. **Si en algún momento hace falta editar un manejador de Express para que la
migración funcione, el diseño se rompió y se corrige antes de seguir** — no se sigue de
largo.

Las citas son otra historia: no tienen repositorio porque nunca tuvieron servidor. Ahí sí
hay trabajo de diseño, y sigue el molde de los mensajes en vez de inventar uno nuevo.

**Dos decisiones cargan casi todo el riesgo técnico** y están investigadas en detalle:

- **D2** — la cadena de conexión va por el pooler de sesión, no por la conexión directa.
  La directa es solo IPv6 y falla desde un contenedor IPv4 con un error que no menciona
  IPv6 por ningún lado.
- **D3** — las tablas viven fuera de `public` **y además** con RLS activado. Una tabla
  `public.citas` sin RLS es legible por cualquiera con la clave publicable, que viaja en el
  navegador: nombre, teléfono, correo y placa de cada cliente.

## Technical Context

**Language/Version**: TypeScript 5.7 con `strict` (Backend) · JavaScript ES2020 sin
transpilar, sin módulos (Frontend)

**Primary Dependencies**: Express 5, cors, dotenv, helmet **+ `postgres` ^3** (postgres.js,
cero dependencias transitivas, interpolación parametrizada por construcción — D1) **+ el
cliente de Resend o `fetch` contra su API HTTP** (D7). **Frontend: ninguna**, lo prohíbe la
constitución.

**Storage**: **Postgres en Supabase**, esquema `cda`, plan gratuito (0 USD/mes). Proyecto
**nuevo bajo la cuenta de la empresa** (`admincdavalledupar@gmail.com`), región
**`us-east-1`** (D4). Conexión por **Supavisor en modo sesión, puerto 5432**. El archivo
JSON y su volumen quedan como respaldo hasta cerrar la verificación.

**Testing**: `npx tsc --noEmit` + `node:test` (Backend), con pruebas de integración HTTP
sobre `app.listen(0)` como las de la 002. Frontend: **navegador**, principio IV. La 002 ya
dejó el precedente de una simulación en Node que dio por bueno algo que el navegador
desmintió.

**Target Platform**: Railway para API y sitio · Supabase para la base · navegadores modernos.
**Los dos servicios de Railway se mudan de US West a US East** como parte del tramo 1, para
quedar pegados a la base y, de paso, más cerca de Colombia (D4).

**Project Type**: aplicación web con frontend y backend separados

**Performance Goals**: agendar responde antes del corte de 6 s del navegador. Los cortes del
servidor (conexión y consulta) se fijan **por debajo** de ese número, para que el API alcance
a devolver un error entendible antes de que el navegador se rinda por su cuenta (D8).

**Constraints**:

- **La conexión directa de Supabase es solo IPv6.** Determina la cadena de conexión (D2).
- **La región del proyecto no se cambia después de crearlo.** Se decide antes (D4).
- **El conector de Supabase de las sesiones de trabajo no ve la cuenta de la empresa.** Las
  migraciones las aplica una persona desde el editor SQL del panel (D4).
- **Queda abierta la verificación de transferencia internacional de datos** bajo la Ley 1581
  (D4). Se eligió `us-east-1` por razones técnicas sabiendo que este punto falta confirmar.
- El frontend no tiene compilación ni módulos: agregar un archivo son **tres ediciones** y
  **subir el `?v=`**.
- El limitador cuenta en memoria de un proceso y depende de `TRUST_PROXY`, ya configurado.
- El envío de correo **no puede** estar en el camino crítico de la cita (D7).

**Scale/Scope**: 3 endpoints nuevos + 2 repositorios nuevos + 1 script de mudanza · 2 tablas
· 2 páginas del frontend a reconectar (`schedule.js`, `admin.js`) · un negocio con un local,
cientos de citas al mes

## Constitution Check

*GATE: debe pasar antes de la fase 0. Revisado de nuevo tras el diseño de la fase 1.*

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| **I. Los datos del negocio no se inventan** (NO NEGOCIABLE) | Los cupos por franja quedan **sin implementar** y marcados como pregunta al propietario (FR-028): estimar la capacidad del CDA está prohibido. El modelo queda preparado para cuando responda. Se levanta además una pregunta nueva: los cuatro medios de pago publicados hay que ratificarlos. | ✅ |
| **II. Los datos personales fallan cerrado** (NO NEGOCIABLE) | Crear cita es público (la constitución lo autoriza explícitamente); listar y cambiar estado exigen credencial y dan 503 si no está configurada. Sin `DATABASE_URL` válida el arranque se corta, no se degrada al archivo. Tablas fuera de `public` **y** con RLS. El registro de accesos sigue sin cadenas de consulta ni direcciones de red. | ✅ |
| **III. La persistencia va detrás de una interfaz** | Se escriben implementaciones nuevas de las interfaces existentes y se cambian las líneas de `dependencias.ts`. Los manejadores no se tocan. **Se declara como criterio de fallo del plan**: si hay que editar un manejador, se para y se corrige el diseño. | ✅ |
| **IV. Cada lado se valida como puede** | Backend: `tsc --noEmit` + `npm test`, con integración HTTP. Frontend: los 13 pasos de navegador de [quickstart.md](./quickstart.md), incluidos los cinco caminos de fallo que nadie prueba. | ✅ |
| **V. Todo de cara al usuario, en español** | Errores de validación campo por campo en español; el correo al cliente en español; los mensajes de fallo reutilizan los textos que ya existen en vez de inventar variantes. | ✅ |

**Restricciones técnicas**: una dependencia nueva de backend (`postgres`, cero
transitivas) más el envío de correo. Cero dependencias de frontend. Secretos por entorno,
nunca versionados. Los archivos con datos de clientes siguen en `.gitignore`.

**Sin violaciones que justificar.** La sección *Complexity Tracking* queda vacía a propósito.

## Project Structure

### Documentation (this feature)

```text
specs/003-persistencia-supabase/
├── plan.md              # Este archivo
├── spec.md              # Qué y por qué
├── research.md          # D1–D10: las decisiones y lo que se descartó
├── data-model.md        # Tablas, mapeo de nombres, estados, índices
├── quickstart.md        # Cómo verificar que funciona
├── contracts/
│   └── citas.md         # Los tres endpoints nuevos
├── checklists/
│   └── requirements.md  # Validación de la especificación
└── tasks.md             # Lo genera /speckit-tasks — NO existe todavía
```

### Source Code (repository root)

```text
Backend/
├── migraciones/                      # NUEVO — el esquema, versionado y revisable (D5)
│   ├── 001-esquema-cda.sql
│   └── 002-indices-y-rls.sql
├── scripts/
│   └── mudar-mensajes.ts             # NUEVO — un solo uso, idempotente (D6)
└── src/
    ├── config.ts                     # + DATABASE_URL, RESEND_API_KEY, CORREO_REMITENTE
    ├── dependencias.ts               # ← las líneas que cambian de implementación
    ├── app.ts                        # + montaje de /api/citas con sus limitadores
    ├── basedatos/
    │   └── conexion.ts               # NUEVO — el pool, sus cortes y su cierre limpio
    ├── correo/
    │   └── enviarConfirmacion.ts     # NUEVO — best-effort, fuera del camino crítico
    ├── repositorios/
    │   ├── repositorioCitas.ts       # NUEVO — la interfaz
    │   ├── repositorioCitasPostgres.ts
    │   └── repositorioMensajesPostgres.ts
    ├── rutas/
    │   └── citas.ts                  # NUEVO
    ├── tipos/
    │   └── cita.ts                   # NUEVO
    └── validacion/
        └── citas.ts                  # NUEVO — lista blanca, como la de mensajes

Frontend/
├── pages/
│   ├── schedule.js                   # deja localStorage, POSTea al API
│   └── admin.js                      # lee citas del API, agrega cambio de estado
├── utils.js                          # helper de citas, como cargarMensajesAdmin
└── index.html                        # subir ?v= a 16
```

**Structure Decision**: se conserva la separación `Backend/` + `Frontend/` que ya existe.
Las carpetas nuevas del backend (`basedatos/`, `correo/`, `migraciones/`, `scripts/`) siguen
la organización por responsabilidad que ya usan `repositorios/`, `rutas/`, `validacion/` y
`middlewares/`. El frontend no gana archivos: son ediciones a los que ya están, así que **no
hay que tocar `index.html` salvo para el `?v=`**.

## Orden de construcción

Sale de las prioridades de la especificación, no del orden en que es cómodo escribir código.
Cada tramo deja algo verificable.

| # | Tramo | Historias | Deja funcionando |
|---|---|---|---|
| 1 | Proyecto de Supabase (cuenta de la empresa, `us-east-1`), **mudanza de Railway a US East**, esquema, RLS, conexión y configuración que falla cerrado | — | Nada visible, pero el arranque ya se corta si falta configuración |
| 2 | `RepositorioCitas` + `POST /api/citas` + validación de servicio en servidor | US1, US2 | Las citas **llegan al servidor** |
| 3 | `GET /api/citas` + panel leyendo del API | US1 | El CDA **las ve** desde cualquier equipo |
| 4 | `schedule.js` POSTeando, con sus caminos de fallo | US2 | El cliente sabe la verdad sobre su cita |
| 5 | `RepositorioMensajesPostgres` + mudanza idempotente | US3 | Todo en un solo almacenamiento |
| 6 | `PATCH .../estado` + botones del panel | US4 | El panel sirve para operar |
| 7 | Correo de confirmación | US5 | El cliente se lleva algo a mano |

El tramo 1 no entrega valor de cara al usuario y va primero igual: es el que hace que un
error de configuración se note al arrancar en vez de seis meses después.

Los tramos 2 a 4 son el corazón —lo que hoy está roto— y **se pueden desplegar sin los
demás**. Si el trabajo se corta a la mitad, cortarlo después del 4 deja el sistema
arreglado; cortarlo antes, no.

## Complexity Tracking

*Sin violaciones a la constitución. Nada que justificar.*
