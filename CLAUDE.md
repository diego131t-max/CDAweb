# webCDA — CDA de Valledupar

Sitio y sistema de agendamiento del Centro de Diagnóstico Automotor de Valledupar
(Cesar, Colombia). Revisión técnico-mecánica y de gases para motos y vehículos.

**Es un negocio real con clientes reales.** Los datos que maneja son datos personales
(nombre, teléfono, correo, placa) y lo que publica son promesas comerciales. Eso condiciona
casi todas las decisiones de este repositorio.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/002-endurecimiento-seguridad/plan.md
<!-- SPECKIT END -->

## Estructura

```
Frontend/   SPA en JavaScript sin build, sin npm, sin módulos
Backend/    API en Express + TypeScript (strict)
specs/      Especificaciones por funcionalidad (Spec Kit)
.specify/   Configuración de Spec Kit + la constitución del proyecto
.claude/    Agentes especializados y skills de Spec Kit
```

## Cómo se corre

Hacen falta **los dos procesos**. Desde que el catálogo de servicios vive en el API, el
sitio ya no funciona solo:

```bash
cd Backend && npm run dev     # API en http://localhost:3000/api
node Frontend/server.js       # sitio en http://localhost:5173
```

El backend necesita `Backend/.env` (copiar de `.env.example`). Sin `ADMIN_TOKEN` los
endpoints de administración responden 503 a propósito: fallan cerrado, nunca abiertos.

**Y necesita `DATABASE_URL`**: desde que citas y mensajes viven en Postgres, el API no
arranca sin base. Tiene que ser la cadena del **pooler de sesión** de Supabase
(`aws-…pooler.supabase.com:5432`), no la conexión directa: esa es solo IPv6 y falla con un
error que no menciona IPv6 por ningún lado.

## Lo que hay que saber antes de tocar código

**El frontend no tiene build.** Nada de `import`/`export`: todo vive en ámbito global y se
carga por `<script>` en orden de dependencia en `index.html`. Agregar una página son **tres
ediciones** (el archivo en `pages/`, su `<script>`, y la rama en `render()` de `app.js`), y
hay que **subir el `?v=`** o el navegador sirve la versión vieja. Los detalles completos
están en el agente de frontend.

**La persistencia va detrás de una interfaz de repositorio** (`Backend/src/repositorios/`).
Los handlers de Express nunca tocan el almacenamiento. Citas y mensajes están en **Postgres
(Supabase)**, esquema `cda`, fuera de `public` y con RLS activado sin políticas: dos capas
para que la clave publicable —que viaja en el navegador de cualquier visitante— no alcance
los datos de los clientes. El esquema está versionado en `Backend/migraciones/`.

La mudanza del archivo JSON a Postgres fue **escribir otra implementación de la misma
interfaz y cambiar el punto de composición** (`dependencias.ts`); ni las rutas ni los
manejadores se tocaron. Si alguna vez hay que editar un manejador para cambiar de
almacenamiento, el diseño se rompió y se corrige antes de seguir.

**Trampa conocida:** Tailwind del CDN pisa la clase `.container` del sitio (misma
especificidad, se inyecta después), así que el ancho de contenido salta en escalones
768/1024/1280 en vez del `min(1180px, 100%)` que declara `styles.css`. Hoy no rompe nada,
pero explica desbordes raros en anchos intermedios. Corregirlo afecta todas las páginas.

## Dónde vive el conocimiento

| Qué | Dónde |
|---|---|
| Principios no negociables del proyecto | [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| Convenciones de cada dominio | [.claude/agents/](.claude/agents/) — `webcda-frontend`, `webcda-backend` |
| Qué se decidió y por qué | [specs/](specs/) — spec, plan, tasks, analysis, converge |
| El razonamiento de cada cambio | Los mensajes de commit |

**Leé la constitución antes de trabajar acá.** Dos principios son NO NEGOCIABLES: no
inventar datos del negocio (precios, servicios, horarios se confirman con el propietario),
y que los datos personales fallen cerrado.

## Estado actual

**En producción**: sitio en `https://cdavalledupar.com` y API en `https://api.cdavalledupar.com`,
los dos en Railway (US East), con la base en Supabase (`us-east-1`).

Implementado y verificado contra producción: catálogo de servicios en el API; agendamiento
que **llega al servidor** (antes la cita se guardaba en el navegador del cliente y el CDA no
se enteraba nunca), con la regla de exclusión por vehículo aplicada del lado del servidor;
panel `#/admin` que lista citas y mensajes y marca una cita como atendida o cancelada;
mensajes de contacto en Postgres; limitador de peticiones con `trust proxy` bien configurado.

Pendiente, en orden de importancia (detalle en
[specs/003-persistencia-supabase/tasks.md](specs/003-persistencia-supabase/tasks.md)):

1. **Verificación en navegador real** de agendamiento, panel y caminos de fallo (T025, T030,
   T042). El principio IV de la constitución la exige y prohíbe simularla.
2. **Ratificar con el propietario** los seis servicios y los cuatro medios de pago que el
   sitio publica. Se adoptaron de lo que ya decía el sitio, no de una confirmación. Ojo con
   "Certificado de Blindaje": si el CDA no lo presta, la regla de exclusión para motos se
   queda sin caso. Y FR-028 (cupos por franja) está sin implementar a propósito hasta que
   diga si existe un tope.
3. **Correo de confirmación al cliente — CONSTRUIDO Y APAGADO A PROPÓSITO.** El código está
   completo, probado y desplegado (`Backend/src/correo/`), pero **no manda nada**: sin
   `RESEND_API_KEY` y `CORREO_REMITENTE` la función corta antes de tocar la red. **No hay
   nada que reimplementar.** Lo que falta es el trámite: crear la cuenta de Resend, verificar
   el dominio con sus registros de DNS y poner esas dos variables en Railway (T043), y
   después verificar que el correo llegue a bandeja de entrada y no a spam (T048). El
   propietario decidió esperar; prenderlo es poner las dos variables.
4. **Rotar la contraseña de la base y el `ADMIN_TOKEN`.** Los dos se pegaron en una sesión de
   trabajo.
5. **Retirar `RepositorioMensajesArchivo`** y el volumen de Railway (T049–T050).

## Convenciones

- **Todo el texto visible y los mensajes de error, en español**, tuteando al usuario.
  Comentarios en español también.
- TypeScript estricto en el backend; nada de `any` sin justificación escrita.
- El backend valida con `npx tsc --noEmit` y `npm test`. El frontend no tiene tests ni
  build: **se valida en el navegador**, y no hay atajo.
- El trabajo se delega a los agentes de `.claude/agents/` según el dominio. Una tarea que
  cruce front y back se reparte, no se resuelve mezclada.
