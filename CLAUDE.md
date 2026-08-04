# webCDA — CDA de Valledupar

Sitio y sistema de agendamiento del Centro de Diagnóstico Automotor de Valledupar
(Cesar, Colombia). Revisión técnico-mecánica y de gases para motos y vehículos.

**Es un negocio real con clientes reales.** Los datos que maneja son datos personales
(nombre, teléfono, correo, placa) y lo que publica son promesas comerciales. Eso condiciona
casi todas las decisiones de este repositorio.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/001-catalogo-servicios/plan.md
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

## Lo que hay que saber antes de tocar código

**El frontend no tiene build.** Nada de `import`/`export`: todo vive en ámbito global y se
carga por `<script>` en orden de dependencia en `index.html`. Agregar una página son **tres
ediciones** (el archivo en `pages/`, su `<script>`, y la rama en `render()` de `app.js`), y
hay que **subir el `?v=`** o el navegador sirve la versión vieja. Los detalles completos
están en el agente de frontend.

**La persistencia va detrás de una interfaz de repositorio** (`Backend/src/repositorios/`).
Los handlers de Express nunca tocan el almacenamiento. Hoy es un archivo JSON; la migración
a Postgres/Supabase está pendiente y debe ser escribir otra implementación y cambiar una
línea de `dependencias.ts`.

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

Implementado y verificado: catálogo de servicios en el API consumido por el agendamiento y
el panel; endpoints de mensajes de contacto con autenticación provisional; página de
tarifas. El panel `#/admin` estaba caído entero por un `ReferenceError` y ya funciona.

Pendiente, en orden de importancia (detalle en
[specs/001-catalogo-servicios/tasks.md](specs/001-catalogo-servicios/tasks.md), fase 6):

1. **T018 — Probar en un navegador real.** La verificación del catálogo se hizo con
   simulación en Node. El principio IV de la constitución exige el navegador.
2. **T019 — Ratificar los seis servicios con el propietario.** Se adoptaron de lo que el
   sitio ya publicaba, no de una confirmación. Revisar sobre todo "Certificado de Blindaje":
   si el CDA no lo presta, la regla de exclusión para motos se queda sin caso.
3. **T020** — Las citas siguen en `localStorage`; la validación de servicio es solo de
   cliente hasta que migren al API.
4. **T021** — `POST /api/mensajes` es público y sin rate limiting.
5. **T022** — Versionar el script de verificación del panel.

## Convenciones

- **Todo el texto visible y los mensajes de error, en español**, tuteando al usuario.
  Comentarios en español también.
- TypeScript estricto en el backend; nada de `any` sin justificación escrita.
- El backend valida con `npx tsc --noEmit` y `npm test`. El frontend no tiene tests ni
  build: **se valida en el navegador**, y no hay atajo.
- El trabajo se delega a los agentes de `.claude/agents/` según el dominio. Una tarea que
  cruce front y back se reparte, no se resuelve mezclada.
