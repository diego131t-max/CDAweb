# Implementation Plan: Catálogo de servicios del CDA

**Branch**: `001-catalogo-servicios-del-cda` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-catalogo-servicios/spec.md`

## Summary

El catálogo de servicios pasa a vivir en el API como dato único y se expone en un endpoint
público de lectura. El frontend lo consume al arrancar y lo usa en dos lugares: el
formulario de agendamiento (donde el cliente elige servicio, filtrado por el tipo de
vehículo) y el panel de administración (donde se muestra el servicio de cada cita y el
conteo por servicio). El `ReferenceError` que hoy tumba el panel desaparece como
consecuencia de que el catálogo exista, no como parche aparte.

## Technical Context

**Language/Version**: TypeScript 5.7 (Backend) · JavaScript ES2020 sin transpilar (Frontend)

**Primary Dependencies**: Express 5, cors, dotenv (Backend). Ninguna en Frontend — no hay
npm ni bundler.

**Storage**: catálogo servido desde constante versionada en código, detrás de la interfaz
de repositorio. Las citas siguen en `localStorage` del navegador (sin cambios en esta
iteración).

**Testing**: `npx tsc --noEmit` + `node:test` (Backend). Verificación manual en navegador
(Frontend), según el principio IV de la constitución.

**Target Platform**: navegadores modernos · Node.js en Windows para el API

**Project Type**: aplicación web con frontend y backend separados

**Performance Goals**: el catálogo se carga una sola vez al iniciar la aplicación; no debe
agregar latencia perceptible al primer render.

**Constraints**: el frontend no tiene build ni módulos — todo es ámbito global cargado por
`<script>` en orden. El `render()` del router es **síncrono**, así que la carga del
catálogo no puede ocurrir dentro de él.

**Scale/Scope**: 6 servicios, 4 tipos de vehículo, 1 exclusión. Volumen despreciable.

## Constitution Check

*GATE: revisado contra `.specify/memory/constitution.md` v1.0.0.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. No inventar datos del negocio | ✅ Pasa | Los 6 servicios se adoptan de lo ya publicado en el sitio, con la ratificación pendiente registrada como suposición explícita en la spec. No se inventa ninguno. |
| II. Datos personales fallan cerrado | ✅ No aplica / Pasa | El catálogo **no es dato personal**: es información comercial que el sitio ya publica, y el formulario la necesita sin autenticar. Por eso su lectura es pública. Ningún endpoint de esta funcionalidad expone datos de clientes. |
| III. Persistencia detrás de una interfaz | ✅ Pasa | Se crea `RepositorioServicios`, siguiendo el patrón de `RepositorioMensajes`. Los handlers no conocen la implementación. |
| IV. Cada lado se valida como puede | ✅ Pasa | Backend con `tsc --noEmit` y tests de la regla de exclusión; frontend probado en navegador. |
| V. Todo en español | ✅ Pasa | Nombres de servicio, mensajes de error y comentarios en español. |

**Sin violaciones.** La sección Complexity Tracking queda vacía.

## Project Structure

### Documentation (this feature)

```text
specs/001-catalogo-servicios/
├── spec.md              # Especificación (con Clarifications)
├── plan.md              # Este archivo
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Salida de /speckit-tasks
```

No se generan `research.md` ni `contracts/` por separado: no hay incógnitas técnicas que
investigar y el contrato del API es un único endpoint de lectura, documentado más abajo.
Crear esos archivos sería ceremonia sin contenido.

### Source Code (repository root)

```text
Backend/
└── src/
    ├── tipos/servicio.ts                        # Servicio, TipoVehiculo
    ├── repositorios/
    │   ├── repositorioServicios.ts              # La interfaz (puerto)
    │   └── repositorioServiciosEstatico.ts      # Implementación + catálogo semilla
    ├── rutas/servicios.ts                       # GET /api/servicios
    └── dependencias.ts                          # (modificado) instancia el repositorio

Frontend/
├── data.js         # (modificado) quita el catálogo contradictorio del chatbot
├── utils.js        # (modificado) serviceOptions() deja de estar muerta; carga del catálogo
├── app.js          # (modificado) carga el catálogo ANTES del primer render
├── pages/
│   ├── schedule.js # (modificado) <select> de servicio filtrado por vehículo
│   └── admin.js    # (modificado) consume el catálogo; deja de reventar
└── index.html      # (modificado) bump de ?v=
```

**Structure Decision**: se mantiene la separación `Backend/` + `Frontend/` que ya existe.
El backend sigue exactamente el patrón que estableció `mensajes`: tipo → interfaz de
repositorio → implementación → ruta → registro en `dependencias.ts`.

## Modelo de datos

```ts
type TipoVehiculo = 'Motos 2T' | 'Motos 4T' | 'Vehículos Livianos' | 'Vehículos Pesados';

interface Servicio {
  id: string;                        // estable, para referencias: 'revision-tecnico-mecanica'
  nombre: string;                     // visible al cliente, en español
  vehiculosExcluidos: TipoVehiculo[]; // vacío = aplica a todos
}
```

Se modela por **exclusión** y no por inclusión porque la regla real es una sola excepción
(blindaje no aplica a motos). Listar los tipos aplicables en los 6 servicios repetiría los
cuatro valores 5 veces y haría que agregar un tipo de vehículo obligue a tocar todas las
filas.

El `id` estable es lo que permite que renombrar un servicio de cara al cliente no rompa las
citas ya registradas ni el conteo del panel.

## Contrato del API

```
GET /api/servicios          → 200 { servicios: Servicio[] }
```

Público y sin autenticación: el formulario de agendamiento lo necesita antes de que exista
cualquier sesión, y no expone datos de clientes (ver Constitution Check, principio II).

## Decisiones de diseño

**El catálogo es una constante versionada, no un archivo JSON mutable.** A diferencia de
los mensajes, el catálogo no lo escribe ningún usuario: cambia cuando el negocio cambia,
del orden de una vez al año. Vivir en código lo deja versionado y revisable por diff, que
es lo correcto para configuración de negocio. La interfaz de repositorio se mantiene igual,
así que migrar a una tabla de Postgres sigue siendo escribir otra implementación.

**El frontend carga el catálogo una sola vez, antes del primer render.** `render()` es
síncrono y no puede volverse asíncrono sin reescribir el router. La carga ocurre en el
arranque de `app.js`, guarda el resultado en un global y recién entonces hace el primer
render.

**Si el API no responde, el agendamiento se bloquea con explicación.** No se duplica el
catálogo como respaldo en el frontend: dos copias del mismo dato es exactamente la
contradicción que esta funcionalidad viene a eliminar. El formulario muestra un mensaje
claro y no deja confirmar una cita sin servicio.

## Limitación conocida (importante)

**FR-004 y FR-010 quedan validados solo del lado del cliente en esta iteración.** Las citas
siguen viviendo en `localStorage`: el API no las recibe, así que no puede rechazar una
combinación inválida de servicio y vehículo. Quien manipule el navegador puede guardarse
una cita inválida en su propio equipo.

El impacto real es acotado — esa cita no llega al CDA porque no hay servidor que la
reciba — pero **la validación deja de ser efectiva recién cuando las citas migren al API**,
que es la funcionalidad siguiente. Queda registrado para no dar por cerrada una garantía
que hoy no existe del lado servidor.

## Complexity Tracking

Sin violaciones al Constitution Check. Sección vacía a propósito.
