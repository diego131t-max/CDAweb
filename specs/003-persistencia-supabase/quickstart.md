# Guía de verificación — Persistencia central y citas

**Funcionalidad**: 003-persistencia-supabase · **Fecha**: 2026-08-10

Cómo comprobar que esto funciona de verdad. No es la lista de tareas (esa la genera
`/speckit-tasks`): es lo que hay que poder ejecutar y ver al final.

El orden importa. Cada bloque asume el anterior.

---

## Preparación

### 1. Crear el proyecto de Supabase

Uno **nuevo**, del CDA. No se reutiliza `MVP-backend`: es de otro sistema y acá van datos
personales de clientes reales.

- Región: la misma donde corre el API en Railway (hoy **US West**). Ver D4 de
  [research.md](./research.md) — **no se puede cambiar después**.
- Costo verificado: **0 USD/mes** en el plan gratuito.

### 2. Aplicar el esquema

Los `.sql` versionados en `Backend/migraciones/`, en orden. Al terminar, comprobar en el
editor SQL del panel:

```sql
-- Las dos tablas existen y están fuera de public
select table_schema, table_name from information_schema.tables
where table_schema = 'cda';

-- RLS activado en ambas (rowsecurity debe ser true)
select relname, relrowsecurity from pg_class
where relnamespace = 'cda'::regnamespace and relkind = 'r';
```

### 3. Variables del servicio `api` en Railway

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | Supabase → **Connect** → **Session pooler**, puerto **5432** |
| `RESEND_API_KEY` | Panel de Resend |
| `CORREO_REMITENTE` | Una dirección de `cdavalledupar.com` ya verificada en Resend |

⚠️ **La cadena tiene que ser la del pooler de sesión, no la conexión directa.** La directa
es solo IPv6 y falla con `ENETUNREACH` o `connection refused` — un error que no menciona
IPv6 y manda a buscar donde no es. El porqué completo está en D2.

`DATA_DIR` **se conserva** hasta terminar la verificación: el volumen queda de respaldo.

---

## Verificación del backend

Antes de subir nada: `cd Backend && npx tsc --noEmit && npm test` (principio IV).

### El arranque falla cerrado

Lo primero, porque es lo que protege todo lo demás (FR-014).

| Qué se prueba | Cómo | Qué tiene que pasar |
|---|---|---|
| Sin `DATABASE_URL` en producción | quitar la variable, arrancar | **corta el arranque** con un mensaje que dice qué falta |
| `DATABASE_URL` mal formada | poner `no-es-una-url` | corta el arranque |
| Base inalcanzable al arrancar | apuntar a un host que no existe | corta el arranque, **no** se cae al archivo JSON |

Si alguna de las tres arranca igual, está mal: una configuración incompleta que arranca es
un API guardando citas donde nadie las mira.

### Los endpoints, contra el API desplegado

```bash
API=https://api.cdavalledupar.com

# Agendar (público) → 201
curl -s -X POST $API/api/citas -H "Content-Type: application/json" -d '{
  "clientName":"Prueba Quickstart","phone":"3166962144","email":"prueba@ejemplo.com",
  "plate":"ABC123","vehicle":"Vehículos Livianos",
  "service":"Revisión Técnico-Mecánica","date":"2026-12-01","time":"09:00",
  "payment":"Efectivo"}'

# Servicio inexistente → 400, aunque el navegador no lo haya impedido (FR-005)
curl -s -X POST $API/api/citas -H "Content-Type: application/json" -d '{
  "clientName":"Prueba","phone":"3166962144","plate":"ABC123",
  "vehicle":"Vehículos Livianos","service":"Cambio de aceite",
  "date":"2026-12-01","time":"09:00","payment":"Efectivo"}'

# Fecha pasada → 400 (FR-007)
# ...mismo cuerpo con "date":"2020-01-01"

# id o status inyectados → se descartan, el 201 los devuelve generados por el servidor
# ...mismo cuerpo agregando "id":"HACKEADO","status":"atendida"

# Listar sin credencial → 401, sin filtrar ningún dato
curl -s -o /dev/null -w "%{http_code}\n" $API/api/citas

# Listar con credencial → 200
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $API/api/citas

# Cambiar estado → 200, devuelve la cita con el estado nuevo
curl -s -X PATCH $API/api/citas/<ID>/estado \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"atendida"}'

# Estado inválido → 400
# ...con '{"status":"lista"}'
```

### La mudanza de los mensajes

1. Contar los mensajes **antes**: `curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $API/api/mensajes`
2. Ejecutar la mudanza.
3. Contar **después**: mismo número, mismos nombres, **mismas fechas originales**.
4. **Ejecutarla otra vez.** El número no puede cambiar (FR-012). Es la prueba que importa:
   la primera corrida puede fallar a la mitad y hay que poder repetirla sin miedo.

---

## Verificación en el navegador

No se simula. Principio IV, y en la 002 ya pasó que la simulación en Node dio por bueno algo
que el navegador desmintió.

Sobre **https://cdavalledupar.com**, con la consola abierta (F12):

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| 1 | Agendar una cita completa | Confirmación en pantalla, **sin errores en consola** |
| 2 | Abrir `#/admin` en **otro navegador u otro equipo** | La cita del paso 1 está ahí |
| 3 | Marcarla como atendida | El cambio se ve; recargando sigue atendida |
| 4 | Abrir el panel desde un tercer dispositivo | El estado es el mismo |
| 5 | Redesplegar el API y volver al panel | Todo sigue |

### Los caminos de fallo, que son los que nadie prueba

| # | Cómo provocarlo | Qué tiene que pasar |
|---|---|---|
| 6 | Pausar el proyecto de Supabase y agendar | Aviso de que **no** se registró, lo escrito se conserva, ofrece WhatsApp. **Nunca** la pantalla de "¡Cita Agendada!" |
| 7 | Con la base caída, navegar el sitio | Inicio, tarifas y FAQ siguen funcionando: el sitio informativo no se cae porque la base esté caída |
| 8 | Con la base caída, abrir el panel | Dice que **no pudo consultar**, no "no hay citas" (FR-010) |
| 9 | Con la base caída, marcar una cita | Avisa que no se pudo y sigue mostrando el estado **anterior** (FR-022) |
| 10 | Con `RESEND_API_KEY` inválida, agendar | **La cita se registra igual** y la pantalla **no** promete ningún correo (FR-025, FR-026) |

El paso 10 es el que más fácil se implementa mal: si el envío de correo está dentro de la
transacción o antes de responder, un proveedor de correo caído convierte una cita bien
guardada en un error para el cliente.

### El correo

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| 11 | Agendar **con** correo | Llega, en español, con servicio, vehículo, fecha, hora y contacto del CDA |
| 12 | Agendar **sin** correo (campo vacío) | La cita se registra y no se intenta ningún envío |
| 13 | Revisar dónde cayó el del paso 11 | Bandeja de entrada, no spam. Si cae en spam, faltan registros de DNS del remitente |

---

## Cierre

Solo cuando todo lo anterior pasó:

1. Retirar `RepositorioMensajesArchivo` del punto de composición.
2. Conservar el volumen de Railway y su contenido **al menos una semana** después de la
   mudanza. Es el único respaldo de los mensajes anteriores hasta que los de Supabase
   tengan historia propia.
3. Borrar de la base los registros de prueba de esta guía.

---

## Lo que esta guía no puede verificar

**Los cupos por franja** (FR-028): no hay nada que probar hasta que el propietario diga si
existe un límite.

**Que el correo llegue a todos los proveedores.** Se comprueba con Gmail, que es lo que usa
casi todo el mundo en Valledupar. Outlook y Yahoo se verifican si aparece una queja.
