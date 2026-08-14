# Modelo de datos — Persistencia central

**Funcionalidad**: 003-persistencia-supabase · **Fecha**: 2026-08-10

Dos tablas sin relación entre sí, en un esquema propio (`cda`, ver D3 de
[research.md](./research.md)). No hay claves foráneas porque no hay nada a qué apuntar: el
catálogo de servicios sigue siendo una constante en código.

---

## Por qué los nombres no coinciden entre capas

El tipo `Mensaje` existente lleva sus campos en inglés (`name`, `email`, `message`, `date`)
y tiene escrito el motivo: **son el contrato que el panel ya renderiza**, así que no se
traducen. La cita está en la misma situación — `clientName`, `plate`, `service` vienen del
formulario y del panel.

Las **columnas**, en cambio, van en `snake_case` y en español, que es la convención de
Postgres y la del resto del proyecto.

Traducir entre ambos es trabajo del repositorio, y es exactamente para lo que existe. Pero
un mapeo implícito es un generador de errores silenciosos —un campo que se guarda en la
columna equivocada no falla, solo miente—, así que va escrito abajo, campo por campo.

---

## Tabla `cda.citas`

| Columna | Tipo | Nulo | Campo en el API | Origen |
|---|---|---|---|---|
| `id` | `uuid` | no | `id` | **servidor** |
| `nombre_cliente` | `text` | no | `clientName` | cliente |
| `telefono` | `text` | no | `phone` | cliente |
| `correo` | `text` | **sí** | `email` | cliente |
| `placa` | `text` | no | `plate` | cliente |
| `vehiculo` | `text` | no | `vehicle` | cliente |
| `servicio` | `text` | no | `service` | cliente |
| `fecha` | `date` | no | `date` | cliente |
| `hora` | `time` | no | `time` | cliente |
| `pago` | `text` | no | `payment` | cliente |
| `estado` | `text` | no | `status` | **servidor** |
| `creado_en` | `timestamptz` | no | `creadoEn` | **servidor** |
| `actualizado_en` | `timestamptz` | **sí** | — | **servidor** |

### Decisiones que no son obvias

**`id` lo genera el servidor.** Hoy lo arma el navegador con
`CDA-${Date.now().toString().slice(-6)}`, que colisiona en cuanto dos personas agendan en el
mismo milisegundo del mismo ciclo de seis dígitos, y además deja que el cliente elija su
propio identificador. Pasa a ser un `uuid` del servidor, igual que en los mensajes. **Esto
es un cambio de contrato**: el frontend deja de mandar `id`.

**`correo` es el único campo opcional.** El formulario lo marca sin asterisco y FR-024 lo
confirma. De ahí sale la rama del aviso por correo: sin correo no se intenta ningún envío.

**`fecha` y `hora` van en columnas separadas**, y no como un solo `timestamptz`. Dos
razones: contar cuántas citas hay en una franja horaria es una consulta directa sobre
`hora`, que es lo que hará falta el día que se responda FR-028 sobre cupos; y una cita es
una hora local de Valledupar acordada con una persona, no un instante absoluto — guardarla
con zona horaria invitaría a que se corra sola si algún día el servidor cambia de región.

**`fecha` no admite días anteriores a hoy** (FR-007). La validación va en el servidor, con
la fecha de Colombia: `fechaHoyEnColombia()` ya existe y se reutiliza. Usar UTC daría el día
equivocado después de las 19:00 hora local — el mismo error que ya se corrigió en
`fechaHoyLocal()` del frontend.

**`pago` es una preferencia declarada, no un pago.** El sistema **no cobra nada**. El
formulario ofrece PayU, MercadoPago, Efectivo y Transferencia Bancaria, y lo que se guarda
es cuál dijo preferir el cliente. Se registra tal como el sitio ya lo publica.

> ⚠️ **Para ratificar con el propietario**, junto con los seis servicios (T019 de la 001):
> ¿el CDA efectivamente acepta esos cuatro medios de pago? Están publicados en un sitio en
> producción. Si alguno no se acepta, es una promesa comercial falsa — principio I.

### Estados y sus transiciones

```
                  ┌──────────────┐
   (se agenda) ──▶│  pendiente   │
                  └──────┬───────┘
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
      ┌─────────────┐         ┌─────────────┐
      │  atendida   │         │  cancelada  │
      └─────────────┘         └─────────────┘
```

- Toda cita nace **`pendiente`**. El cliente nunca elige el estado.
- Solo el personal autenticado cambia el estado (FR-019, FR-021).
- **`cancelada` no borra la fila** (FR-020). El CDA necesita saber que la cita existió y no
  se atendió; borrarla perdería esa información y falsearía cualquier conteo.
- **Borrar existe, pero es otro acto** (FR-029, agregado el 2026-08-14). `DELETE /api/citas/:id`
  elimina la fila de verdad, y **solo si ya está `cancelada`**. Son dos pasos deliberados:
  cancelar es reversible, borrar no. Existe por los registros de prueba, el spam y los
  duplicados —que no son historia del negocio— y sobre todo por el derecho de supresión de
  la Ley 1581.
- Las transiciones desde `atendida` y `cancelada` se permiten (alguien se equivoca de fila y
  tiene que poder corregirlo). Lo que **no** se permite es un estado fuera de los tres.
- El estado se restringe en la base con `check`, no solo en el código. Una restricción en el
  código protege al código que la respeta; una en la base protege a la tabla.

---

## Tabla `cda.mensajes`

| Columna | Tipo | Nulo | Campo en el API | Origen |
|---|---|---|---|---|
| `id` | `uuid` | no | `id` | servidor |
| `nombre` | `text` | no | `name` | cliente |
| `correo` | `text` | no | `email` | cliente |
| `mensaje` | `text` | no | `message` | cliente |
| `fecha` | `date` | no | `date` | servidor |
| `creado_en` | `timestamptz` | no | `creadoEn` | servidor |

Réplica exacta del tipo `Mensaje` que ya existe. **No se aprovecha la mudanza para
rediseñarlo**: mezclar una migración de datos con un cambio de contrato es cómo se pierden
datos sin saber cuál de los dos cambios tuvo la culpa.

`fecha` se conserva **del registro original**, no de la mudanza (D6). Un mensaje del 8 de
agosto sigue siendo del 8 de agosto.

---

## Índices

| Tabla | Índice | Para qué |
|---|---|---|
| `cda.citas` | `(fecha, hora)` | La consulta del panel: las citas del día en orden. También la de cupos, si se responde FR-028. |
| `cda.citas` | `(estado)` parcial sobre `estado = 'pendiente'` | Lo que el mostrador mira todo el día: lo que falta atender. |
| `cda.mensajes` | `(creado_en desc)` | El panel los lista del más reciente al más viejo, que es como ya se comportaba el archivo JSON. |

Son tres índices sobre tablas que van a tener cientos de filas, no millones. Están porque
son baratos y porque el orden de listado ya es parte del comportamiento observable, no por
una necesidad de rendimiento medida.

---

## Seguridad de las tablas

Ambas tablas, además de vivir fuera de `public`:

```sql
alter table cda.citas    enable row level security;
alter table cda.mensajes enable row level security;
```

**Sin ninguna política.** RLS activado y sin políticas deniega todo a los roles sujetos a
él, que son justamente `anon` y `authenticated` — los que usaría cualquiera con la clave
publicable. El API se conecta como `postgres`, dueño de las tablas y no sujeto a RLS, así
que sigue operando con normalidad.

El razonamiento completo de por qué esto va **además** del esquema separado está en D3 de
[research.md](./research.md).

---

## Lo que este modelo deja preparado y no implementa

**Cupos por franja (FR-028).** Con `fecha` y `hora` en columnas propias y un índice sobre
ellas, contar las citas de una franja es una consulta. Si el propietario confirma que hay
tope, se agrega la validación; no hay que rehacer el modelo ni migrar datos.

**Trazabilidad por persona.** Ninguna tabla registra *quién* del CDA cambió un estado,
porque con una credencial compartida esa pregunta no tiene respuesta. Cuando existan
usuarios reales se agrega la columna; anotarla ahora sería guardar un dato falso.
