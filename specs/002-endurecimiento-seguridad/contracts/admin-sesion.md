# Contrato — `GET /api/admin/sesion`

**Estado**: nuevo en esta funcionalidad · **Autenticación**: obligatoria

Único endpoint nuevo. Existe para que el panel pueda preguntar *"¿esta credencial sirve?"*
**sin mover datos personales** para averiguarlo (ver D6 de [research.md](../research.md)).

---

## Petición

```http
GET /api/admin/sesion HTTP/1.1
Authorization: Bearer <credencial>
```

Sin cuerpo, sin parámetros. Cualquier cadena de consulta se ignora.

---

## Respuestas

### 200 — La credencial sirve

```json
{ "estado": "ok" }
```

Cabecera obligatoria: `Cache-Control: no-store`. No devuelve **ningún** dato: la respuesta es
la misma para toda credencial válida.

### 401 — Falta la credencial o es incorrecta

```json
{ "error": "Se requiere autenticación de administrador." }
```

```json
{ "error": "Credenciales de administrador inválidas." }
```

Ambas con `WWW-Authenticate: Bearer realm="webCDA"`. Los textos son los que ya devuelve
`crearAutenticacionAdmin`; no se inventan mensajes nuevos. **Ninguno revela nada sobre la
credencial esperada** (FR-005).

### 429 — Demasiados intentos fallidos

```json
{ "error": "Demasiados intentos. Espera unos minutos antes de volver a intentar." }
```

Se dispara tras 10 fallos en 15 minutos desde el mismo origen (FR-020). **Los aciertos no
cuentan**: el personal del CDA no se autobloquea trabajando.

### 503 — El servidor no tiene credencial configurada

```json
{ "error": "El panel de administración no está disponible: falta configurar la autenticación en el servidor." }
```

Es el fallo cerrado que ya implementa el middleware: sin credencial configurada —o con la
credencial de ejemplo de la plantilla (FR-026)— el endpoint **no queda abierto**. Se responde
lo mismo aunque el cliente mande exactamente ese valor.

---

## Reglas de implementación

1. **Mismo middleware que el resto.** Reusa `autenticacionAdmin` de `dependencias.ts`. No se
   escribe una segunda comparación de credenciales: dos caminos de autenticación es cómo se
   diverge y uno queda flojo.
2. **No toca almacenamiento.** No hay repositorio detrás. Es el único endpoint autenticado que
   puede decir esto.
3. **No entra en el registro de accesos a datos personales.** Es justamente su motivo de
   existir: mantener ese registro con una entrada por lectura real (D9).
4. Va montado en `/api/admin`, para que las rutas de administración de la ronda 2 tengan dónde
   colgarse.

---

## Cómo lo usa el panel

Al abrir `#/admin` con una credencial guardada en la pestaña, el sitio llama a este endpoint y
espera como máximo 6 segundos:

| Resultado | Qué hace el panel |
|---|---|
| `200` | Abre |
| `401` | Borra la credencial guardada y pide una nueva |
| `429` | No abre; explica que hay que esperar |
| `503` | No abre; explica que el servidor no tiene la autenticación configurada |
| Red caída o 6 s sin respuesta | **No abre.** Falla cerrado (FR-002) |

Las cinco filas que no son `200` terminan igual: sin acceso a datos personales.

---

## Contratos existentes que esta funcionalidad NO cambia

| Endpoint | Cambio |
|---|---|
| `GET /api/health` | Ninguno |
| `GET /api/servicios` | Ninguno. Sigue público (no expone datos de clientes) |
| `POST /api/mensajes` | **Contrato igual.** Se le agrega límite de peticiones: puede responder `429` |
| `GET /api/mensajes` | **Contrato igual.** `limite` pasa a tener tope por omisión de 100 (FR-024); antes, sin `limite`, devolvía todo |

Todos, además, empiezan a responder con las cabeceras de seguridad de helmet.
