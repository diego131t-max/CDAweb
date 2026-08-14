# Contrato — `/api/citas`

**Estado**: nuevo en esta funcionalidad

Tres operaciones sobre el mismo recurso, con **tres niveles de acceso distintos**. La
separación es la que fija el principio II: crear una cita es una de las dos operaciones
públicas del sistema; leerlas y modificarlas mueve datos personales y exige credencial.

| Operación | Acceso | Limitador |
|---|---|---|
| `POST /api/citas` | **público** | limitador público (20 / 15 min) |
| `GET /api/citas` | credencial | limitador de credencial (10 fallos / 15 min) |
| `PATCH /api/citas/:id/estado` | credencial | limitador de credencial |

El montaje por método replica el patrón que ya usa `/api/mensajes` en `app.ts`
(`soloEnMetodo`): es la misma dirección con dos naturalezas, y aplicarle un solo limitador
dejaría el `GET` con datos personales detrás de un tope pensado para un formulario público.

---

## `POST /api/citas` — agendar

Público. Es la operación que hoy no existe y por la cual el CDA no recibe las citas.

### Petición

```http
POST /api/citas HTTP/1.1
Content-Type: application/json
```

```json
{
  "clientName": "Juan Pérez",
  "phone": "3166962144",
  "email": "juan@ejemplo.com",
  "plate": "ABC123",
  "vehicle": "Vehículos Livianos",
  "service": "Revisión Técnico-Mecánica",
  "date": "2026-08-15",
  "time": "09:00",
  "payment": "Efectivo"
}
```

`email` es **opcional**; todo lo demás es obligatorio.

**`id`, `status` y `creadoEn` NO se aceptan del cliente** y se descartan si vienen. Es la
misma lista blanca contra asignación masiva que ya aplica `validarNuevoMensaje`. Hoy el
navegador arma el `id` por su cuenta (`CDA-` + milisegundos recortados); deja de hacerlo.

### 201 — Registrada

```json
{
  "id": "3f2b8c1e-...",
  "clientName": "Juan Pérez",
  "phone": "3166962144",
  "email": "juan@ejemplo.com",
  "plate": "ABC123",
  "vehicle": "Vehículos Livianos",
  "service": "Revisión Técnico-Mecánica",
  "date": "2026-08-15",
  "time": "09:00",
  "payment": "Efectivo",
  "status": "pendiente",
  "creadoEn": "2026-08-10T21:14:02.518Z"
}
```

**Este 201 es el único disparador legítimo de la pantalla de confirmación** (FR-008). Sale
después de que la base confirmó la escritura, y **antes** de intentar el correo: el envío no
forma parte de esta respuesta ni la puede demorar (FR-025, D7).

### 400 — Datos inválidos

```json
{
  "error": "Revisa los datos de la cita.",
  "detalles": {
    "plate": "La placa es obligatoria.",
    "date": "La fecha no puede ser anterior a hoy."
  }
}
```

Reporta **todos** los campos inválidos de una vez, en español, diciendo qué campo y por qué.
Mismo formato que ya devuelve la validación de mensajes.

Incluye el caso de FR-005: un `service` que no está en el catálogo vigente se rechaza acá,
del lado del servidor, sin depender de que el navegador lo haya impedido.

### 429 — Demasiados intentos

```json
{ "error": "Demasiados intentos. Espera unos minutos antes de volver a intentar." }
```

Con `Retry-After`. Texto exacto de `MENSAJE_DEMASIADOS_INTENTOS`; no se inventa uno nuevo.

### 503 — El almacenamiento no responde

```json
{ "error": "No pudimos registrar tu cita en este momento. Intenta de nuevo en unos minutos o escríbenos por WhatsApp." }
```

Es el caso que FR-009 y SC-005 gobiernan. **No revela nada del almacenamiento**: ni el
motor, ni el host, ni el error del driver (FR-017). El sitio muestra el aviso, conserva lo
escrito y ofrece el WhatsApp.

Una demora que agota el tiempo de corte llega acá también: la demora **es** un fallo (D8).

---

## `GET /api/citas` — listar

Requiere credencial. Mueve datos personales de todos los clientes que agendaron, así que
**falla cerrado**: sin credencial configurada en el servidor, 503; con credencial inválida,
401.

### Petición

```http
GET /api/citas?desde=2026-08-10&hasta=2026-08-17&estado=pendiente&limite=100 HTTP/1.1
Authorization: Bearer <credencial>
```

Todos los parámetros son opcionales. `desde`/`hasta`/`limite` siguen exactamente la
semántica que ya tiene `validarFiltroMensajes`; `estado` es nuevo y solo admite los tres
valores válidos.

### 200

```json
{ "citas": [ /* … objetos como el del 201, más recientes primero */ ] }
```

Ordenadas por `fecha` y `hora`. Una lista vacía significa **cero citas**, no un error: la
distinción es lo que exige FR-010, y el panel tiene que poder confiar en ella para no
decirle al personal "nadie agendó" cuando la verdad es "no pudimos preguntar".

### 401 · 429 · 503

Idénticas a las de `/api/mensajes`. El 503 cubre dos causas distintas con el mismo código:
credencial no configurada (fallo cerrado del principio II) y almacenamiento caído.

> El registro de accesos **no** guarda la cadena de consulta (FR-016). Acá importa más que
> antes: `?estado=` no es dato personal, pero registrar cadenas de consulta sienta el
> precedente que filtra el día que alguien agregue `?placa=`.

---

## `PATCH /api/citas/:id/estado` — marcar atendida o cancelada

Requiere credencial. Es la única operación de escritura del panel.

### Petición

```http
PATCH /api/citas/3f2b8c1e-.../estado HTTP/1.1
Authorization: Bearer <credencial>
Content-Type: application/json
```

```json
{ "status": "atendida" }
```

Únicos valores aceptados: `pendiente`, `atendida`, `cancelada`.

**Solo el estado.** No se editan los datos de la cita por esta vía ni por ninguna otra en
esta funcionalidad — está en los supuestos de la especificación. Reprogramar se resuelve por
teléfono.

### 200

Devuelve la cita completa con su estado nuevo, para que el panel muestre lo que quedó
guardado y no lo que intentó guardar (FR-022).

### 400

```json
{ "error": "El estado debe ser 'pendiente', 'atendida' o 'cancelada'." }
```

### 404

```json
{ "error": "No encontramos esa cita." }
```

### 401 · 429 · 503

Como arriba. Ante un 503, el panel **sigue mostrando el estado anterior**, que es el real
(FR-022). No se pinta el estado optimista: mostrar "atendida" cuando la escritura falló le
haría creer al mostrador que ya registró algo que no registró.

---

## Lo que este contrato NO define

**Cupos.** No hay respuesta prevista para "esa franja está llena" porque no se sabe si
existe un límite (FR-028, pendiente del propietario). Si se confirma que lo hay, se agrega
un **409** con un mensaje que diga qué franjas quedan libres. El modelo de datos ya está
preparado para calcularlo.

**Borrar una cita.** ~~No existe y no se agrega: cancelar no borra (FR-020).~~
**Se agregó después de cerrar esta funcionalidad.** El contrato está abajo; el porqué del
cambio de opinión, en la sección que sigue.

---

## `DELETE /api/citas/:id` — borrar definitivamente

**Agregado el 2026-08-14**, después de que el resto de este contrato se diera por cerrado.

Requiere credencial. **Solo borra citas que ya están `cancelada`.**

| Situación | Código | Cuerpo |
|---|---|---|
| Se borró | **200** | `{ "id": "…", "borrada": true, "mensaje": "La cita se borró definitivamente." }` |
| No existe | **404** | `{ "error": "No encontramos esa cita." }` |
| Existe pero no está cancelada | **409** | `{ "error": "Solo se pueden borrar las citas canceladas, y esta está pendiente. Cancelala primero: …" }` |
| Sin credencial | **401** | — |
| Base caída | **503** | `{ "error": "No pudimos borrar la cita en este momento…" }` |

**La respuesta del 200 no trae los datos de la cita**, solo su `id`. Devolver el nombre, el
teléfono y la placa de alguien justo cuando se acaba de pedir eliminarlos sería lo contrario
de lo que la operación significa.

**El 404 y el 409 son códigos distintos a propósito.** Le dicen al mostrador dos cosas que no
se parecen —"esa cita ya no está" contra "cancelala primero"— y colapsarlas en un error
genérico deja a alguien apretando un botón que no explica por qué no funciona.

### Por qué existe, si acá decía que no se agregaba

**FR-020 sigue vigente y no se tocó: cancelar nunca borra.** Su razonamiento —el CDA
necesita saber que una cita existió y no se atendió— vale para las citas de clientes reales,
y por eso borrar exige **dos actos deliberados**: primero cancelar, que es reversible y se
ve, y recién después borrar.

Lo que ese razonamiento no cubrió son tres cosas que igual terminan en la tabla: registros de
prueba, spam de robots y duplicados. Ninguno es historia del negocio; conservarlos falsea los
conteos en la dirección contraria a la que FR-020 quería evitar.

Y hay un cuarto caso que pesa más que los tres, y que la especificación directamente no
consideró: **la Ley 1581 le da a una persona el derecho de supresión de sus datos
personales.** Un sistema que estructuralmente no puede borrar los datos de un cliente que
los reclama no es prolijo, es incumplidor — el mismo cuerpo de ley que ya dejó T054
pendiente por la región de la base.

La restricción a las canceladas se aplica **en el repositorio**, no en la ruta ni en el
panel: una comprobación en la interfaz protege a la interfaz.
