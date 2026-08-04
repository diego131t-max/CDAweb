# Modelo de datos — Endurecimiento de seguridad (ronda 1)

Esta funcionalidad **no crea entidades persistentes nuevas**. Lo que cambia es *dónde vive* una
entidad que ya existía y *qué estados* atraviesa el acceso al panel.

---

## Sesión de administración (nueva, solo en memoria)

Representa el estado de la credencial dentro de **una pestaña** del navegador. No se persiste
en el servidor: no hay sesiones que emitir en esta ronda (ver D6).

| Campo | Dónde vive | Vida |
|---|---|---|
| `credencial` | `sessionStorage`, clave `adminToken` | Hasta cerrar la pestaña o cerrar sesión |
| `estado` | Variable de módulo en `utils.js` | Hasta recargar la página |

### Estados y transiciones

```
                    ┌──────────────────┐
        ┌──────────►│  sin-credencial  │◄──────────┐
        │           └────────┬─────────┘           │
        │                    │ la persona la envía │
   401 / 503 /               ▼                     │ cerrar sesión
   red caída /       ┌──────────────┐              │
   6 s sin           │  verificando │──────────────┤
   respuesta         └───────┬──────┘              │
        │                    │ 200                 │
        │                    ▼                     │
        │            ┌──────────────┐              │
        └────────────┤  verificada  ├──────────────┘
                     └──────────────┘
```

**Reglas que no admiten excepción:**

1. Solo el estado `verificada` muestra datos personales. `sin-credencial` y `verificando` no
   muestran ni uno.
2. **Toda salida del camino feliz va a `sin-credencial`.** Falta de credencial, credencial
   incorrecta, servidor caído, credencial no configurada en el servidor y demora excesiva
   terminan todas en el mismo lugar: sin acceso (FR-002).
3. **Recargar la página vuelve a `verificando`, nunca a `verificada`.** Aunque la credencial
   siga guardada en la pestaña, cada carga se revalida contra el servidor. El navegador nunca
   decide solo que alguien está autenticado.
4. Al pasar a `sin-credencial` por rechazo del servidor, la credencial guardada **se borra**.

---

## Mensaje de contacto (cambia de lugar)

La forma del dato **no cambia** — es la que ya define el backend y la que el panel ya sabe
mostrar. Lo que cambia es dónde vive y quién puede leerlo.

| Campo | Tipo | Reglas (ya existentes en el backend) |
|---|---|---|
| `id` | texto | Lo genera el **servidor** |
| `date` | `YYYY-MM-DD` | Lo genera el **servidor** |
| `name` | texto | 2–80 caracteres |
| `email` | texto | 1–120, con formato de correo |
| `message` | texto | 5–1000 caracteres |

**Antes**: `localStorage`, clave `messages`, en el navegador de quien lo escribió. El CDA nunca
lo veía.

**Después**: `Backend/data/mensajes.json`, ignorado por git por contener datos personales.
Crear es público; **leer exige credencial**.

**Migración**: no hay. Los mensajes que hoy estén en el navegador de alguien no se suben —
serían datos de origen no verificable, y el único que existe hoy es la semilla de ejemplo, que
esta funcionalidad elimina (FR-013). La clave `messages` de `localStorage` deja de leerse.

---

## Cita (**no** cambia en esta ronda)

Sigue viviendo en `localStorage` bajo la clave `appointments`, con los campos que ya tiene:
`id`, `clientName`, `phone`, `email`, `cedula`, `plate`, `vehicle`, `service`, `date`, `time`,
`payment`, `status`.

**Lo que sí cambia es cómo se muestra**: sus campos pasan por el escape antes de llegar a la
pantalla (FR-007). El tratamiento va **en la vista, no en el guardado** — así las citas
registradas antes de esta funcionalidad quedan cubiertas sin migrar nada.

> **Límite conocido**: al seguir en el navegador, quien tenga acceso físico al equipo y las
> herramientas de desarrollo las lee sin credencial. Se cierra en la ronda 2. Ver la sección
> "Límite conocido de esta ronda" de [spec.md](./spec.md).

**Pendiente del propietario**: el campo `cedula` se recoge y se guarda pero no se muestra, no
se envía y el formulario de cuatro pasos ni lo pide. Si el propietario confirma que no se usa,
se quita del formulario y del objeto.

---

## Registro de acceso (nuevo, efímero)

Una línea por petición a la salida estándar. **No se persiste** y no es una entidad del dominio.

| Campo | Ejemplo |
|---|---|
| Fecha | `2026-08-04T15:32:11.204Z` |
| Método | `GET` |
| Ruta | `/api/mensajes` — **sin cadena de consulta** |
| Estado | `200` |
| Duración | `12ms` |

**Prohibido, sin excepción** (FR-028): cuerpo de la petición, cabecera de autorización,
cadena de consulta y **dirección de red**. La dirección de red es dato personal bajo la Ley 1581
de 2012, y el principio II dice que los datos personales no aparecen en registros.

**Lo que este registro puede y no puede responder**: sirve para saber **qué** se accedió y
**cuándo**. No sirve para saber **quién** — con una credencial compartida y sin usuarios, esa
pregunta no tiene respuesta en este sistema. La trazabilidad por persona llega en la ronda 2.

---

## Contador del limitador (nuevo, en memoria)

| Campo | Valor |
|---|---|
| Clave | **SHA-256 truncado** de la dirección de red, nunca la dirección |
| Marcas | Momentos de las peticiones dentro de la ventana |

Dos configuraciones (ver D4):

| Uso | Ventana | Tope | Qué cuenta |
|---|---|---|---|
| Operaciones públicas | 15 min | 20 | Todas las peticiones |
| Autenticación | 15 min | 10 | **Solo los fallos** |

Las entradas vencidas **se purgan**: un mapa que solo crece es, él mismo, una forma de tumbar
el servicio. El conteo vive en un solo proceso; con varias instancias el tope se cuenta por
instancia (limitación aceptada y anotada en el plan).
