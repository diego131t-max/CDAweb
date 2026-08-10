# Investigación — Persistencia central y citas que llegan al CDA

**Funcionalidad**: 003-persistencia-supabase · **Fecha**: 2026-08-10

Cada decisión lleva qué se eligió, por qué, y qué se descartó. Las que tienen trampa
—D2 sobre todo— llevan además el síntoma que produce equivocarse, porque es el que uno
busca en Google sin encontrar la causa.

---

## D1 — Cliente de Postgres: `postgres` (postgres.js)

**Decisión**: `postgres@^3` como único cliente de base de datos.

**Por qué**:

- **Cero dependencias transitivas.** El repositorio ya rechazó `express-rate-limit` y
  escribió el limitador a mano por esto mismo; sumar un árbol de seis paquetes para hablar
  con Postgres iría contra esa línea.
- **Interpolación segura por construcción.** Sus plantillas etiquetadas parametrizan solo
  con escribir `` sql`select * from cda.citas where id = ${id}` ``. No hay una forma cómoda
  de concatenar SQL a mano, que es justo lo que se quiere cuando lo que viaja son placas y
  nombres escritos por desconocidos.
- **Tipos de TypeScript de primera**, sin `@types/` aparte.

**Alternativas descartadas**:

- **`pg` (node-postgres)** — el estándar y la opción conservadora. Se descarta por el árbol
  de dependencias y porque sus consultas parametrizadas (`$1`, `$2`) se pueden eludir
  concatenando sin que nada avise. Es una diferencia de "difícil de hacer mal" contra
  "posible hacer mal".
- **`@supabase/supabase-js`** — es un cliente REST sobre PostgREST, no un driver. Meterlo
  detrás de `RepositorioMensajes` sería poner una capa HTTP dentro de otra capa HTTP, y
  arrastraría las claves publicables y las políticas de acceso al camino de cada petición.
  El principio III pide una implementación de repositorio, no un segundo API.
- **Un ORM (Prisma, Drizzle)** — el modelo son dos tablas sin relaciones. Un ORM acá es
  peso muerto y un generador de código en un backend que hoy compila con `tsc` y nada más.

---

## D2 — Modo de conexión: pooler de sesión (Supavisor), NO conexión directa

**Decisión**: la cadena de conexión es la del **Shared Pooler en modo sesión**:

```
postgres://postgres.[REF]:[CLAVE]@aws-[REGION].pooler.supabase.com:5432/postgres
```

**Por qué esto es una trampa y no un detalle**: la conexión directa de Supabase
(`db.[REF].supabase.co:5432`) es **solo IPv6** en los planes gratuito y de pago. El IPv4
existe únicamente con un complemento pago, y ese complemento **no es dual-stack**: cambia el
registro AAAA por uno A, no agrega.

Si el contenedor de Railway no tiene salida IPv6, la conexión directa falla con
`ENETUNREACH` o `connection refused`. Ese mensaje no menciona IPv6 por ningún lado y manda a
revisar contraseñas, cortafuegos y cadenas de conexión durante horas.

El pooler en modo sesión es **IPv4 en todos los planes**, está pensado exactamente para
"backend persistente en redes solo-IPv4", y **soporta sentencias preparadas** —que el modo
transacción (puerto 6543) no soporta y que postgres.js usa por omisión—.

Elegirlo hace que la pregunta "¿Railway tiene IPv6?" deje de importar. Es la opción que no
hay que investigar.

**Alternativas descartadas**:

- **Conexión directa (5432)** — obliga a verificar el soporte de IPv6 de Railway y a
  depender de que no cambie. Se reserva para migraciones y `pg_dump` desde una máquina de
  desarrollo, que es su caso de uso documentado.
- **Pooler en modo transacción (6543)** — es para funciones serverless y efímeras. El API
  del CDA es un proceso largo. Además rompe las sentencias preparadas de postgres.js salvo
  que se desactiven a mano.
- **Complemento de IPv4** — cuesta plata por un problema que el pooler resuelve gratis.

> **Verificación empírica disponible**: la pestaña **Console** del servicio en Railway
> permite correr `curl -6 https://ifconfig.co/ip`. Si devuelve una dirección, hay IPv6.
> No hace falta para esta decisión, pero sirve si algún día se quiere la conexión directa.

---

## D3 — Aislamiento de las tablas: esquema propio `cda` **y** RLS activado

**Decisión**: las tablas viven en un esquema `cda`, no en `public`, **y además** se les
activa Row Level Security sin ninguna política.

**Por qué las dos cosas y no una**: es el mismo criterio de defensa en dos capas que la
funcionalidad 002 aplicó al escape y la política de contenido. Dos caminos independientes
para el mismo riesgo, y un fallo en uno no basta.

El riesgo concreto: Supabase expone automáticamente por PostgREST las tablas del esquema
`public`, y la clave anónima está **diseñada para ser pública** —viaja en el navegador—.
Una tabla `public.citas` sin RLS es una tabla que cualquiera con esa clave puede leer
entera: nombre, teléfono, correo y placa de cada cliente del CDA. Eso es exactamente la
filtración que el principio II existe para impedir.

- **Capa 1 — el esquema `cda`**: PostgREST solo expone los esquemas configurados
  (`public`, `graphql_public`). Las tablas en `cda` no existen para el API de datos.
- **Capa 2 — RLS sin políticas**: si algún día alguien agrega `cda` a los esquemas
  expuestos, o mueve una tabla a `public`, RLS sin políticas deniega todo por omisión.

El API se conecta como `postgres`, que es dueño de las tablas y **no** está sujeto a RLS,
así que el backend sigue funcionando con normalidad.

**Alternativa descartada**: solo RLS en `public`. Funciona, pero deja las tablas
publicadas por PostgREST y confía todo a que las políticas estén bien. Una política mal
escrita es un error silencioso; un esquema no expuesto no lo es.

---

## D4 — Región del proyecto: la del API, no la del cliente

**Decisión**: crear el proyecto de Supabase en la misma región donde corre el API. Hoy los
servicios de Railway están en **US West**, así que el proyecto va en `us-west-2`.

**Por qué**: la cadena es `cliente en Valledupar → API en Railway → Postgres`. El primer
salto ya está fijado por dónde está Railway. El segundo se recorre **varias veces por
petición** (validar el servicio, insertar la cita, releer). Cruzar el continente en cada
consulta cuesta más que acercar el servidor al cliente.

**Mejora posterior anotada**: mover **los dos** —Railway y Supabase— a US East acercaría el
sistema entero a Colombia. Es una mejora real pero es otro trabajo, y hacerla a medias
(base en el este, API en el oeste) sería peor que no hacerla. Si se decide mover, se decide
antes de crear el proyecto: **la región de un proyecto de Supabase no se cambia después**,
hay que migrar.

**Costo verificado**: 0 USD al mes. Plan gratuito, confirmado contra la organización.

---

## D5 — Migraciones: SQL versionado en el repositorio

**Decisión**: el esquema vive como archivos `.sql` numerados en `Backend/migraciones/`,
versionados en git. Se aplican con el conector de Supabase o desde el editor SQL del panel.

**Por qué**: el esquema es parte del diseño y tiene que poder leerse, revisarse en un
*diff* y explicarse en un mensaje de commit, como todo lo demás acá. Un esquema que solo
existe dentro del panel de Supabase no se revisa, no queda en el historial y no viaja con el
repositorio — el mismo argumento que puso los `railway.toml` en el repo.

**Alternativa descartada**: la CLI de Supabase con su carpeta `supabase/`. Trae Docker,
un proyecto local y un flujo de trabajo entero para dos tablas. Se puede adoptar el día que
el esquema crezca.

---

## D6 — Mudanza de los mensajes: idempotente por identidad

**Decisión**: un script de un solo uso lee el archivo JSON del volumen e inserta cada
mensaje con `on conflict (id) do nothing`.

**Por qué**: los mensajes ya tienen `id` propio (un UUID que asigna el servidor). Con eso,
volver a correr la mudanza no duplica nada — que es lo que pide FR-012 y lo que uno
necesita cuando la primera corrida falla a la mitad y no sabe por dónde iba.

Se conserva la fecha original (`creadoEn`), no la de la mudanza: un mensaje del 8 de agosto
tiene que seguir figurando como del 8 de agosto.

**El archivo JSON no se borra al terminar.** El volumen queda como respaldo hasta confirmar
que la mudanza salió bien; recién ahí se retira la implementación en archivo.

---

## D7 — Proveedor de correo: Resend, y el envío queda fuera del camino crítico

**Decisión**: Resend como servicio de envío, con remitente del dominio
`cdavalledupar.com`. El envío ocurre **después** de que la cita quedó registrada y su
resultado **no afecta** la respuesta al cliente.

**Por qué Resend**: API simple, se verifica el dominio con registros de DNS —trámite que ya
se hizo hoy en Namecheap para los dominios, así que el camino es conocido— y tiene plan
gratuito. *Confirmar los límites vigentes del plan gratuito al momento de contratarlo; no
se dan por sabidos acá.*

**Por qué fuera del camino crítico**: FR-025 lo exige y la razón es la del formulario de
contacto, otra vez. Si el envío fuera parte de la transacción, un proveedor de correo caído
convertiría una cita perfectamente guardada en un error para el cliente. Registrar la cita y
avisarle al cliente son dos cosas distintas y la primera manda.

De ahí sale una regla para la interfaz: la pantalla de confirmación **no dice** "te
enviamos un correo". Dice que la cita quedó registrada, que es lo que el sistema sabe con
certeza. Prometer un correo que no salió es el mismo error que confirmar una cita que no se
guardó.

**Alternativas descartadas**:

- **WhatsApp Business API** — llega mucho mejor en Valledupar, pero tiene costo por mensaje
  y trámite de aprobación. Anotado como mejora posterior en la especificación.
- **Amazon SES** — más barato a escala, bastante más trabajo de configuración, y el CDA no
  tiene escala.
- **Correo desde el propio servidor (SMTP directo)** — termina en spam. Un dominio nuevo sin
  reputación mandando correo por su cuenta no llega a Gmail.

---

## D8 — Tiempos de corte: la demora se trata como fallo

**Decisión**: la conexión y las consultas tienen corte explícito. Agotado el tiempo, la
operación se reporta como fallida.

**Por qué**: FR-009 y SC-005. Quedarse esperando para siempre no es "todavía no sabemos":
es un formulario colgado que no explica nada. El sitio ya usa este criterio en dos lugares
—6 s para el catálogo, 6 s para la verificación de credencial— y conviene que el tercero se
comporte igual en vez de inventar un número nuevo.

El corte del lado del navegador se mantiene en 6 s por coherencia. Los cortes del lado del
servidor (conexión y consulta) se fijan por debajo, para que el API alcance a responder un
error entendible antes de que el navegador se rinda solo.

---

## D9 — Validación del servicio: del lado del servidor, contra el catálogo vigente

**Decisión**: `POST /api/citas` valida que el servicio pedido exista en el catálogo,
consultando el mismo `RepositorioServicios` que ya usa `GET /api/servicios`.

**Por qué**: hoy esa validación es solo del navegador, y una validación de cliente es una
comodidad, no un control — se saltea con una petición hecha a mano. FR-005 la exige del lado
del servidor. Reutilizar el repositorio existente evita que el catálogo quede definido en
dos lugares que se desincronizan.

**La cita guarda el servicio elegido, no una referencia viva.** Si el CDA deja de prestar un
servicio mañana, las citas ya registradas no se alteran: el catálogo cambia hacia adelante.

---

## D10 — Límite de peticiones para crear citas

**Decisión**: `POST /api/citas` va detrás del **mismo limitador público** que ya protege
`POST /api/mensajes` (20 peticiones cada 15 minutos por visitante).

**Por qué**: es la otra operación pública del sistema, o sea la otra que se puede inundar
desde internet. Y ahora que las citas ocupan filas en una base de datos, inundarla cuesta
más que antes.

Se reutiliza la instancia existente de `dependencias.ts` en vez de crear otra: dos
operaciones públicas compartiendo cupo es el comportamiento deseado, y crear un limitador
nuevo por endpoint sería multiplicar el cupo total que se le da a una misma dirección.

**Depende de `TRUST_PROXY`**, que se configuró correctamente al desplegar. Sin eso el
limitador agrupa a todos los visitantes en el mismo cubo — ver el comentario en
`limitarPeticiones.ts`.

---

## Lo que quedó sin resolver

**Cupos por franja horaria (FR-028).** No es una pregunta técnica: es la capacidad operativa
real del CDA y el principio I prohíbe estimarla. La investigación no puede resolverla.

Lo que sí se puede dejar preparado, y se deja: la tabla de citas guarda fecha y hora en
columnas propias, de modo que contar cuántas citas hay en una franja sea una consulta y no
una migración. Si el propietario responde que hay tope, agregar el control es escribir la
consulta y la validación; no hay que rehacer el modelo.
