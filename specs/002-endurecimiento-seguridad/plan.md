# Implementation Plan: Endurecimiento de seguridad (ronda 1)

**Branch**: `002-endurecimiento-seguridad` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-endurecimiento-seguridad/spec.md`

## Summary

Cerrar el panel de administración detrás de una credencial verificada contra el servidor
—hoy está abierto a cualquiera que escriba la dirección, incumpliendo el principio II—, tratar
como texto todo dato de origen externo antes de mostrarlo, mover los mensajes de contacto del
navegador al servidor, eliminar la dependencia de un script de terceros y declarar los
orígenes permitidos, y ponerle al API cabeceras de seguridad, límite de peticiones,
configuración que falla ruidosa y una prueba que impide revertir lo anterior.

El enfoque es **defensa en dos capas para el mismo riesgo**: el escape (D1) y la política de
contenido (D3) atacan la inyección de código por caminos independientes, así que un fallo en
uno no basta para explotarla.

**Todo se construye sobre lo que ya existe**: el middleware de autenticación con comparación en
tiempo constante y fallo cerrado ya está escrito y probado; la validación de mensajes ya tiene
lista blanca contra asignación masiva; el manejador de errores ya evita filtrar rastros y
cuerpos con datos personales. Esta funcionalidad los cablea y los rodea, no los reescribe.

## Technical Context

**Language/Version**: TypeScript 5.7 con `strict` (Backend) · JavaScript ES2020 sin transpilar,
sin módulos (Frontend)

**Primary Dependencies**: Express 5, cors, dotenv **+ helmet ^8.3.0** (nueva, cero dependencias
transitivas). El limitador de peticiones se escribe a mano. **Frontend: ninguna** — lo prohíbe
la constitución.

**Storage**: mensajes en archivo JSON detrás de `RepositorioMensajes` (`Backend/data/`,
ignorado por git). Las citas **siguen en `localStorage`** en esta ronda. La credencial del
panel vive en `sessionStorage` mientras dure la pestaña.

**Testing**: `npx tsc --noEmit` + `node:test` (Backend), incluyendo **pruebas de integración
HTTP nuevas** con `app.listen(0)` y `fetch` nativo. Frontend: **verificación en navegador**,
por principio IV. No hay atajo.

**Target Platform**: navegadores modernos · Node.js sobre Windows para el API

**Project Type**: aplicación web con frontend y backend separados

**Performance Goals**: la verificación de credencial corta a los 6 s, el mismo criterio que ya
usa la carga del catálogo. El límite de peticiones no debe estorbar el uso normal del CDA.

**Constraints**:

- `render()` del router es **síncrono** y reescribe el DOM entero en cada cambio de ruta: la
  verificación asíncrona no puede vivir dentro (ver D7 de [research.md](./research.md)).
- El frontend no tiene compilación ni módulos: agregar un archivo son **tres ediciones**
  (archivo, `<script>` en `index.html`, rama en `render()`) y **subir el `?v=`**.
- El API y el sitio están en **orígenes distintos** (`:3000` y `:5173`): helmet necesita
  `crossOriginResourcePolicy: cross-origin` o rompe el sitio entero (D5).
- El limitador cuenta en la memoria de un solo proceso.

**Scale/Scope**: 4 endpoints existentes + 1 nuevo · 7 rutas del sitio · ~20 puntos de
interpolación a tratar · un negocio con un local

## Constitution Check

*GATE: debe pasar antes de la fase 0. Se reevalúa después de la fase 1.*

| Principio | Estado | Cómo lo cumple |
|---|---|---|
| **I. Los datos del negocio no se inventan** (NO NEGOCIABLE) | ✅ | No se toca ningún dato del negocio. Los dos puntos que sí requieren al propietario —la cédula sin propósito y la política de habeas data— quedan **registrados sin resolver** en la spec, no completados con valores plausibles. |
| **II. Los datos personales fallan cerrado** (NO NEGOCIABLE) | ✅ | Es el objeto mismo de la funcionalidad. FR-001 a FR-006 cierran la vista que hoy está abierta; FR-002 exige negar el acceso cuando la verificación no se pueda completar; FR-027/FR-028 mantienen los datos personales fuera de los registros. Las dos operaciones públicas siguen siendo las mismas dos. |
| **III. La persistencia va detrás de una interfaz** | ✅ | No se toca la capa de datos. El endpoint nuevo (`GET /api/admin/sesion`) no lee almacenamiento. El tope por omisión del listado (FR-024) va en la validación, no en el repositorio. |
| **IV. Cada lado se valida como puede** | ✅ | Backend: `tsc --noEmit` + `npm test`, **con pruebas nuevas de autenticación** (FR-030), que es exactamente lo que el principio exige para lógica de autenticación. Frontend: navegador, con guion en [quickstart.md](./quickstart.md). Cubre además T018, que sigue abierta por haberse verificado en Node. |
| **V. Todo de cara al usuario, en español** | ✅ | Pantalla de credencial, avisos de fallo del contacto y errores del API, en español y tuteando. |

**Restricciones Técnicas**: no se introducen módulos, bundlers ni dependencias con compilación
en el frontend — el script de Tailwind se vendoriza como archivo estático servido por
`<script>`, que es exactamente el mecanismo que la constitución describe. El `?v=` sube a 13.
La única dependencia nueva del backend es helmet, sin `any` y sin tocar `.env`.

**Flujo de Desarrollo**: cada tarea se etiqueta `[FRONT]` o `[BACK]` y se delega al agente de su
dominio. **Ninguna tarea cruza los dos lados.** Cada fase, su commit.

**Resultado del gate: PASA. Sin violaciones.**

## Project Structure

### Documentation (this feature)

```text
specs/002-endurecimiento-seguridad/
├── plan.md              # Este archivo
├── spec.md              # Qué y por qué
├── research.md          # D1–D10: las decisiones técnicas y lo que se descartó
├── data-model.md        # Entidades y estados
├── quickstart.md        # Cómo se verifica que funciona
├── contracts/
│   └── admin-sesion.md  # GET /api/admin/sesion
├── checklists/
│   └── requirements.md  # Calidad de la spec
└── tasks.md             # Lo genera /speckit-tasks
```

### Source Code (repository root)

```text
Backend/
├── src/
│   ├── app.ts                          # NUEVO — construcción de la app (extraída de server.ts)
│   ├── app.test.ts                     # NUEVO — integración HTTP: el guard sigue puesto (FR-030)
│   ├── server.ts                       # queda solo con el arranque + captura de fallos globales
│   ├── config.ts                       # validación del entorno al arrancar (FR-025)
│   ├── dependencias.ts                 # compone los limitadores nuevos
│   ├── middlewares/
│   │   ├── autenticarAdmin.ts          # rechazar la credencial de ejemplo (FR-026)
│   │   ├── limitarPeticiones.ts        # NUEVO — ventana deslizante en memoria (FR-019, FR-020)
│   │   └── registrarAcceso.ts          # NUEVO — traza sin datos personales (FR-027, FR-028)
│   ├── rutas/
│   │   ├── admin.ts                    # NUEVO — GET /api/admin/sesion
│   │   └── mensajes.ts                 # sin cambios de contrato
│   └── validacion/mensajes.ts          # tope por omisión del listado (FR-024)
├── .env.example                        # credencial de ejemplo marcada como inválida
└── package.json                        # + helmet

Frontend/
├── index.html                          # política de contenido, scripts vendorizados, ?v=13
├── server.js                           # traversal, petición malformada, cabeceras (FR-021, FR-022)
├── utils.js                            # escaparHtml(), sesión de admin, quitar la semilla
├── app.js                              # rama /admin con puerta; acotar el prefijo de ruta
├── data.js                             # (sin cambios de contrato)
├── assets/vendor/
│   ├── tailwind.js                     # NUEVO — script vendorizado
│   └── tailwind-config.js              # NUEVO — configuración, fuera del HTML
└── pages/
    ├── admin.js                        # escape en las tablas; mensajes desde el API
    ├── admin-login.js                  # NUEVO — pantalla de credencial
    ├── schedule.js                     # escape; borrar appointmentSurveyTable (código muerto)
    ├── contact.js                       # POST al API; no confirmar lo que no se envió
    └── home.js                         # fecha mínima; validar el servicio del formulario rápido
```

**Structure Decision**: se mantiene la separación `Backend/` + `Frontend/` que el proyecto ya
tiene. El único cambio estructural es **extraer `app.ts` de `server.ts`** en el backend, que es
lo que hace posible la prueba de integración de FR-030 (D8): hoy `server.ts` construye y
arranca en el mismo archivo, así que no hay forma de levantar la app en un puerto de prueba sin
arrancar el servidor real.

## Orden de implementación

**El orden concreto vive en las fases de [tasks.md](./tasks.md), que es la única fuente de
verdad sobre qué se hace primero.** Acá quedan solo las dos restricciones que ese orden tiene
que respetar sí o sí, y el porqué de cada una.

**Restricción 1 — la Historia 2 (escape) va antes que la Historia 3 (mensajes al servidor).**
Hoy el dato sin tratar lo escribe la misma persona que lo ve; al mover los mensajes al servidor
lo escribe cualquiera de internet y lo ve el personal del CDA. **Invertirlas abre un agujero
que hoy no existe.**

**Restricción 2 — helmet va temprano, no con el resto del endurecimiento del API.** Su trampa
de orígenes (D5) rompe el sitio entero. Si se registrara al final, junto con los limitadores y
el registro de accesos, rompería todo lo que ya se hubiera verificado funcionando y habría que
depurar hacia atrás. Va en la fase bloqueante, con un checkpoint que solo pide abrir
`#/agendar`.

Fuera de esas dos, las historias son independientes y se pueden repartir entre agentes de
distinto dominio: el backend de la Historia 1 y su frontend no se estorban, y la Historia 5 no
depende de ninguna.

## Riesgos

| Riesgo | Señal de que ocurrió | Qué hacer |
|---|---|---|
| **helmet rompe el sitio entero** (D5) | El agendamiento dice "no pudimos cargar la lista de servicios" y la petición figura completada en la pestaña de red | `crossOriginResourcePolicy: { policy: "cross-origin" }`. Es el riesgo más probable de toda la funcionalidad. |
| La política bloquea el bloque de datos estructurados (D3) | Violación de política en consola sobre `application/ld+json` | Su hash SHA-256 en `script-src`. **No** aflojar la política. |
| Vendorizar Tailwind cambia el diseño | `#/servicios` se ve distinta | Comparar contra la versión anterior antes de commitear. Es la página que hay que mirar. |
| `connect-src` se olvida al publicar | El sitio publicado no carga el catálogo | Queda anotado junto a `API_URL` en `data.js`: se cambian **los dos** o ninguno. |
| El limitador bloquea al personal del CDA | El mostrador no puede trabajar | Cuenta solo fallos de credencial (D4). Verificar con el uso normal del panel. |
| El escape rompe textos legítimos | Aparecen `&amp;` o `&#39;` visibles en pantalla | Escapar **al mostrar**, nunca al guardar. Verificar con nombres con tilde y apóstrofo. |

## Complexity Tracking

> Se llena solo si el Constitution Check tiene violaciones que justificar.

**Sin violaciones.** La única dependencia nueva (helmet) queda justificada en D5 de
[research.md](./research.md) y no arrastra dependencias transitivas.
