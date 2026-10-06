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

Hacen falta **los dos procesos**. Desde que el catálogo de servicios y **las tarifas** viven
en el API, el sitio ya no funciona solo:

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
carga por `<script>` en orden de dependencia en `index.html`. Agregar una página son **cinco
ediciones** (el archivo en `pages/`, su `<script>`, la rama en `render()` de `app.js`, su
entrada en `METADATOS` y una `<url>` en `sitemap.xml`), y hay que **subir el `?v=`** o el
navegador sirve la versión vieja. Las dos últimas son nuevas desde que el sitio enruta por
rutas reales: **una página sin entrada en `METADATOS` sale con el título de "no encontrada"
y `noindex`**, o sea que existe para las personas y no para Google. Los detalles completos
están en el agente de frontend.

**Una página que NO debe indexarse** (hoy `/encuesta`, a la que se llega por el QR del CDA) entra en
`METADATOS` con `indexar: false`, que `aplicarMetadatosDeRuta()` traduce a `noindex`, y **no** va en el menú
ni en `sitemap.xml`. Tampoco se bloquea en `robots.txt`: Google tiene que poder rastrearla para leer el
`noindex`; con un `Disallow` podría indexar la URL igual si alguien la enlaza.

**Probando en local:** `Frontend/server.js` guarda en **memoria** el gzip de cada archivo y no lo renueva. Tras
editar hay que **reiniciarlo**, o el navegador (que pide gzip) recibe lo viejo mientras `curl` ve lo nuevo. Y
el `?v=` viejo queda cacheado un año (`immutable`): hay que subir el número. Sin `DATABASE_URL` el API local no
arranca, así que lo que pide datos se prueba contra producción por HTTP.

**La persistencia va detrás de una interfaz de repositorio** (`Backend/src/repositorios/`).
Los handlers de Express nunca tocan el almacenamiento. Citas y mensajes están en **Postgres
(Supabase)**, esquema `cda`, fuera de `public` y con RLS activado sin políticas: dos capas
para que la clave publicable —que viaja en el navegador de cualquier visitante— no alcance
los datos de los clientes. El esquema está versionado en `Backend/migraciones/`.

La mudanza del archivo JSON a Postgres fue **escribir otra implementación de la misma
interfaz y cambiar el punto de composición** (`dependencias.ts`); ni las rutas ni los
manejadores se tocaron. Si alguna vez hay que editar un manejador para cambiar de
almacenamiento, el diseño se rompió y se corrige antes de seguir.

**Los precios viven en UN solo lugar, y ese lugar es el backend.**
`Backend/src/tipos/tarifa.ts` tiene la tabla que entregó el propietario, `GET /api/tarifas`
la publica, y el sitio la consume al arrancar junto con el catálogo de servicios. En
`Frontend/data.js` quedan tres variables **vacías** que se llenan en `cargarTarifas()`.

No siempre fue así, y el camino explica la regla: el servidor necesita calcular cuánto vale
una cita para guardarlo —**no puede creerle el precio al cliente**, o cualquiera mandaría el
suyo—, así que por un rato hubo copia en los dos lados con una prueba que las comparaba
número por número. Funcionaba, pero un precio duplicado es una bomba de tiempo: el día que
las dos copias se separan, el sitio cotiza una cifra y el panel muestra otra, y nadie se
entera hasta que un cliente reclame. **Si vas a agregar un dato del negocio que los dos
lados necesiten, servilo desde el API desde el principio.**

Y si el API no responde, las tarifas quedan vacías y **no hay tabla de respaldo**: una copia
vieja publicaría precios que ya no son, y un precio equivocado con aire de correcto es peor
que un "no pudimos consultarlo". `/tarifas` lo dice y ofrece reintentar; el formulario
esconde los campos de tarifa y **deja agendar igual**, porque dejar al CDA sin citas por una
tabla de precios sería peor que no mostrar el monto.

**Trampa conocida:** Tailwind del CDN pisa la clase `.container` del sitio (misma
especificidad, se inyecta después), así que el ancho de contenido salta en escalones
768/1024/1280 en vez del `min(1180px, 100%)` que declara `styles.css`. Hoy no rompe nada,
pero explica desbordes raros en anchos intermedios. Corregirlo afecta todas las páginas.

**Sacar Tailwind está pendiente a propósito.** Son 399 KB —un compilador de CSS corriendo en
el navegador de cada visitante— y se usa en **un solo archivo**, `pages/services.js`
(30 atributos `class`, verificado archivo por archivo). Se pospuso al medirlo: con la
compresión encendida esos 399 KB viajan como ~122 KB, al lado de los 6,4 MB de imágenes que
sí se arreglaron. Sigue valiendo la pena por la CPU del teléfono y porque arregla el bug de
arriba, pero es rediseñar el CSS de una página entera y **exige verificación en navegador**:
va como trabajo propio, no de arrimado en otro cambio.

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

Implementado y verificado contra producción: catálogo de servicios y **tarifas** en el API;
**pago en línea con QR de Bancolombia o transferencia, con comprobante que el cliente sube y
una persona del CDA verifica desde el panel**; **el valor exacto de cada revisión, calculado
por el servidor y guardado con la cita**; agendamiento
que **llega al servidor** (antes la cita se guardaba en el navegador del cliente y el CDA no
se enteraba nunca), con la regla de exclusión por vehículo aplicada del lado del servidor;
panel de administración que lista citas y mensajes, marca una cita como atendida o cancelada
y **borra las canceladas**; mensajes de contacto en Postgres; limitador de peticiones con
`trust proxy` bien configurado; HSTS y **campo trampa** en los tres formularios públicos;
compresión, caché e imágenes en WebP (el inicio pasó de **7 MB a 436 KB**); y la redirección
de `www` al dominio raíz, con el DNS puesto y **verificada contra el dominio real**
(2026-08-15): resuelve, el certificado es válido, y la ruta y la cadena de consulta se
conservan en el 301.

**Indexación y rutas reales, desplegadas** (008 y 009, fusionadas hace tiempo). Salieron de
medir que el sitio **no estaba indexado** —buscando `"cdavalledupar.com"` entre comillas
Google no lo devolvía ni una vez, mientras los tres CDA de la competencia sí salían—. La 008
trajo lo que faltaba para ser descubierto (`robots.txt`, `sitemap.xml`, canónica, `og:`, la
ficha JSON-LD del negocio). La 009 es la que movió la aguja: **el sitio dejó de enrutar por
fragmento**, así que las seis páginas pasaron de ser una sola URL para Google a ser seis,
cada una con su título. Lo que sigue pendiente de eso es registrar el sitio en Search
Console y apuntar el botón de Reservas del Perfil de Empresa a `/agendar`.

**Cierre del sitio (2026-09 y 2026-10), desplegado.** Página **Ubícanos** (`/ubicanos`, `pages/ubicanos.js`):
mapa, dirección, parqueadero y tres rutas (La Paz, Bosconia, la cuarta) que despliegan el mapa **dentro de la
página**; la ubicación salió de Contacto. El mapa con ruta usa `output=embed`, que no es una interfaz
documentada por Google: el enlace "Abrir en Google Maps" es el respaldo si algún día deja de funcionar.
**Cédula obligatoria** en el formulario rápido y en el de cuatro pasos (el servidor la sigue aceptando ausente
por las citas viejas). **El Excel de Reportes trae el detalle de cada cita**, pedido al API por tramos de siete
días para no truncar en el tope de 500. **Addi y Sistecrédito** como medios **solo informativos**
(`mediosInformativos` en `data.js`: fuera del `<select>` y de `MEDIOS_DE_PAGO`; se pagan en la sede). Y la
**encuesta de satisfacción**: `/encuesta` (por QR), **anónima**, con `POST /api/encuestas` público (campo trampa
y limitador) y `GET` privado con el resumen calculado en la base; tabla `cda.encuestas` (migración **006**,
aplicada) y sección **Encuestas** en el panel. La contraseña del panel la elige el propietario: mínimo
**10 caracteres** (antes 16).

> ⚠️ **EL DOMINIO SE PUEDE SUSPENDER SOLO, Y YA PASÓ** (2026-08-25). El sitio y el API
> quedaron caídos con un síntoma que no se parece a nada del código: los dos dominios
> resolviendo a `198.54.117.242`, una IP de estacionamiento de Namecheap.
>
> La causa: **ICANN obliga a verificar el correo del registrante dentro de los 15 días** de
> registrar el dominio, y si no se hace, el registrador TIENE que suspenderlo. Se registró el
> 2026-08-10 y se suspendió el 2026-08-25 — quince días exactos.
>
> **Cómo se reconoce en un segundo**, sin tocar Railway ni el código:
>
> ```bash
> curl -s https://rdap.verisign.com/com/v1/domain/cdavalledupar.com | grep -i ldhName
> ```
>
> Si los nameservers dicen `FAILED-WHOIS-VERIFICATION` y `VERIFY-CONTACT-DETAILS`, es esto.
> **Se arregla haciendo clic en el enlace del correo de Namecheap** (o reenviándolo desde el
> panel del dominio), y NO tocando los registros DNS: no están mal configurados, están
> reemplazados a propósito por la suspensión.

Pendiente, en orden de importancia (detalle en
[specs/003-persistencia-supabase/tasks.md](specs/003-persistencia-supabase/tasks.md)):

1. **Verificación en navegador real — HECHA (2026-10-01).** El propietario dio por hecho todo el punto: el
   agendamiento con QR subiendo una foto, el panel (abrir un comprobante y verificar el pago), el Excel de
   Reportes, la encuesta y los mapas de Ubícanos. **Borró él mismo las citas de prueba** de 2099 (`PRB080`,
   `PRB090`, `PRB100`, `VAL001`–`VAL003`, `CUP001`): una consulta a producción con su credencial no encontró
   ninguna. Lo que sigue sin verse en un teléfono real es lo que depende de apps de terceros.
2. **FR-028 ya está implementado** (2026-08-22). El propietario confirmó el tope: **cuatro
   vehículos por franja, compartidos entre todos los tipos de vehículo**, y **diez franjas**,
   cada hora en punto de 8 a 17 — o sea un techo de 40 vehículos diarios.

   Lo que importa saber si se toca: la lista de franjas vive en `Backend/src/tipos/franja.ts`
   y **el frontend no tiene copia**, ni de respaldo. El desplegable de horas se arma con lo
   que devuelve `GET /api/citas/disponibilidad`. Antes eran cinco horas escritas en un
   `<select>` que no correspondían a nada, y el servidor aceptaba cualquier `HH:MM`: con
   tope eso se vuelve un agujero, porque mandar `09:07` abre una franja nueva y vacía.

   **Contar cupos e insertar ocurren dentro de una transacción con
   `pg_advisory_xact_lock` por (fecha, hora).** No es adorno: sin el candado, dos envíos
   simultáneos cuentan los dos "tres ocupados", insertan los dos, y la franja queda con
   cinco carros. Por eso la regla vive en el repositorio y no en la ruta —es el único lugar
   donde se puede tomar el candado— y por eso `crear()` devuelve `ResultadoCreacion` en vez
   de una cita.

   **Las franjas dependen del día (2026-10-06, rama 069).** Lo de arriba son las de un día hábil.
   `franjasDelDia(fecha)` en `franja.ts` aplica el horario publicado: **sábado hasta la 1:30 PM** (5
   franjas, 08:00 a 12:00), **festivo de 8:00 AM a 12:00 M** (4 franjas, 08:00 a 11:00) y **domingo cerrado**
   (ninguna). El servidor rechaza una hora que no exista ese día (`validacion/citas.ts`) y
   `GET /api/citas/disponibilidad` devuelve las franjas del día más su `tipoDeDia`; el frontend sigue sin
   copia y distingue "No atendemos ese día" de "Sin cupo". Cada día de `resumen` trae su `cupos` real.

   **Los festivos se calculan por ley** (`Backend/src/tipos/festivos.ts`: Ley Emiliani + Pascua), no se
   copian de una lista, así que no caducan. **Una sola excepción a mantener a mano:** el **13 de julio de
   2026** (Virgen de Chiquinquirá) es un festivo nuevo que no sale de ninguna fórmula; está en
   `EXTRAORDINARIOS`, confirmado en dos calendarios. **No se sabe si se repite en 2027**: cuando se
   publique el calendario oficial de cada año hay que compararlo con `festivosDelAnio()` (la lista de 2027 de
   `festivos.test.ts` está derivada a mano de la ley, sin fuente externa). Si el horario publicado cambia,
   se cambia `ULTIMA_FRANJA` en `franja.ts`, `CDA.horario` (`data.js`) y el JSON-LD de `index.html`.

   **La cita `CUP001` que quedó en producción** se creó acá, para verificar que la
   transacción funciona contra Supabase de verdad —lo único que las pruebas no pueden
   cubrir—. Está en la lista de borrado del punto 1, junto con las que dejaron las
   verificaciones del pago en línea.

   **Los medios de pago se ratificaron dos veces.** Primero los presenciales (2026-08-22):
   efectivo y tarjeta por datáfono, los dos al llegar al CDA. El formulario ofrecía "PayU",
   "MercadoPago", "Efectivo" y "Transferencia Bancaria", con **"PayU" como valor por
   omisión**: toda cita en la que el cliente no tocara el desplegable quedó guardada con una
   pasarela que el CDA nunca tuvo. No se confirmó **qué franquicias acepta el datáfono** (2026-10-01: decidido no implementarlo):
   por eso la sección no muestra logos de Visa/Mastercard/Amex.

   **Después llegó el pago en línea, y Wompi quedó DESCARTADO** (2026-08-24) — descartado,
   no pospuesto. En su lugar hay dos vías directas, sin pasarela: el **código QR de
   Bancolombia** y la **transferencia** a la cuenta de ahorros 52330041668 (NIT 900084186).
   Son cuatro medios en total, y la lista vive en `mediosDePago` (`Frontend/data.js`), de
   donde leen el formulario y la sección del inicio.

   Lo que hay que entender antes de tocarlo: **el sistema no cobra y no se entera de que el
   dinero llegó.** Los dos medios en línea piden un **comprobante** que el cliente sube en el
   mismo formulario, y que **una persona del CDA verifica desde el panel**. "Verificado"
   significa que alguien miró una imagen y dijo que sí; nadie le pregunta nada al banco.

   - `payment` **ya es una lista cerrada en el servidor** (`Backend/src/tipos/pago.ts`).
     Era el único campo de opciones que aceptaba texto libre, y así fue como entró "PayU".
     La columna `pago` de la tabla **sigue sin `check`** a propósito: hay filas viejas con
     valores que la restricción rechazaría, y reescribirlas borraría lo que se le prometió
     a esas personas. Se cierra lo que entra, no lo que ya está.
   - `pago_estado` lo **deriva el servidor** del medio elegido. El cliente no lo manda.
   - El archivo va a un **bucket privado de Supabase Storage**, no a Postgres ni al volumen
     de Railway. El backend habla con él por `fetch` contra su API REST — **sin
     dependencias nuevas**, igual que con Resend. El panel nunca recibe un enlace
     permanente: pide una **URL firmada que caduca en 60 segundos**.
   - La subida (`POST /api/citas/:id/comprobante`) es **pública**, porque quien sube es el
     cliente anónimo que acaba de agendar. Lo que la acota: hace falta el UUID v4 de la
     cita, es de un solo disparo (la segunda da 409), se comprueba que la cita exista antes
     de tocar el almacenamiento, el tipo se decide por los **bytes** del archivo y no por la
     cabecera, y comparte el limitador público con `POST /api/citas`.
   - **Sin `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` la subida responde 503** y la cita
     queda "pendiente de comprobante". Falla cerrado: nunca guarda el archivo en otro lado.
   - **Sin dato del negocio (2026-10-01: decidido NO implementarlo, queda así):** el **nombre legal completo del titular** de la
     cuenta. La certificación bancaria lo muestra cortado ("CENTRO DE DIAGNOSTICO AUTOMOTOR
     DE VALLE") y el QR lo trae truncado a 21 caracteres por límite del formato EMV.
     `datosBancarios.titular` está **vacío a propósito** y ese renglón no se muestra.

   **Los servicios ya se ratificaron, y la respuesta cambió el sistema** (2026-08-21): el
   CDA presta **uno solo**, "Revisión Técnico-Mecánica y de Gases". Los otros cinco
   —gases aparte, luces y frenos, peritaje, certificado de blindaje y diagnóstico
   electrónico— **no existen**, y el sitio los estuvo ofreciendo. Por eso el catálogo tenía
   escrita la advertencia de que faltaba confirmarlo. Consecuencias: el formulario de
   agendamiento ya no pregunta el servicio, y **la regla de exclusión de FR-009/FR-010 se
   quedó sin ningún caso real** —era blindaje en motos—. La maquinaria que la aplica sigue
   ahí, del lado del cliente y del servidor, y su prueba se reescribió para inyectar un
   catálogo con exclusión: sin eso pasaba en verde sin probar nada.
3. **El correo público del sitio es `admincdavalledupar@gmail.com`** (2026-08-24). Antes
   era `contacto@cdavalledupar.com`. Vive en `CDA.email` (`Frontend/data.js`), pero **hay
   tres copias más escritas a mano**: el pie de página y la ficha JSON-LD de `index.html`
   —que son HTML estático servido a los rastreadores sin JS, así que no pueden leer de
   `data.js`— y `CONTACTO_CDA` en `Backend/src/correo/enviarConfirmacion.ts`.

4. **Correo de confirmación al cliente — CONSTRUIDO Y APAGADO A PROPÓSITO.** El código está
   completo, probado y desplegado (`Backend/src/correo/`), pero **no manda nada**: sin
   `RESEND_API_KEY` y `CORREO_REMITENTE` la función corta antes de tocar la red.

   Desde 2026-08-24 hay un segundo módulo, `correo/avisarAlCda.ts`, que le escribe **al
   CDA** —cita nueva, comprobante subido (con el archivo adjunto) y mensaje de contacto— a
   `CORREO_ADMIN`. Está igual de apagado y depende del mismo trámite: **el destinatario
   puede ser un Gmail, el remitente no**, tiene que ser del dominio verificado en Resend.
   Mientras tanto **el canal que funciona es el panel**, y todo el diseño lo trata como el
   principal: el correo avisa, no guarda. **No hay
   nada que reimplementar.** Lo que falta es el trámite: crear la cuenta de Resend, verificar
   el dominio con sus registros de DNS y poner esas dos variables en Railway (T043), y
   después verificar que el correo llegue a bandeja de entrada y no a spam (T048). El propietario decidió esperar y el **2026-10-01 decidió no encenderlo**: el canal es el panel. Prenderlo
   sigue siendo poner las dos variables.
5. **Credenciales.** **`ADMIN_TOKEN`: rotado el 2026-10-01** a una contraseña que eligió el propietario. El
   mínimo bajó de 16 a 10 caracteres (`LONGITUD_MINIMA_TOKEN` en `middlewares/autenticarAdmin.ts`); por debajo, o
   con el texto de ejemplo de `.env.example`, el servidor responde 503 y el panel queda cerrado. Cambiarlo en
   Railway **solo después** de desplegar un cambio de mínimo, o el servidor viejo lo rechaza.

   **Siguen sin rotar, y ya no por decisión de dejarlas** (se van a rotar):

   - **La contraseña de Postgres.** Es corta y adivinable, y el endpoint se alcanza desde internet: hoy lo que
     protege los datos es que el esquema `cda` está fuera de `public` y que RLS está activo sin políticas.
   - **La clave secreta de Supabase Storage** (`SUPABASE_SERVICE_ROLE_KEY`). Quedó visible en una captura
     (2026-08-24), así que **está quemada**. Es la que se salta RLS: con ella se llega a la tabla de citas
     entera, no solo al bucket. Rotarla son dos minutos y no rompe nada si va **en este orden**: crear una
     nueva en Settings → API Keys → Secret keys, pegarla en Railway, verificar que el sitio funcione con ella,
     y **solo entonces** revocar la vieja.
6. **Indexación en Google (en curso).** La propiedad ya está registrada en Search Console (prefijo de URL
   `https://cdavalledupar.com/`). **En el HTML no hay etiqueta `google-site-verification`**: este documento decía
   que sí por error. El 2026-10-01 el último rastreo de la home era del 12 de agosto y el sitemap figuraba con
   "No se ha podido obtener" de una lectura vieja, aunque hoy se sirve bien (200, `application/xml`, XML válido,
   7 URLs). Se reenvió el sitemap y se empezó a pedir la indexación URL por URL; Google tarda de horas a semanas.
   **`/encuesta` no se pide**: lleva `noindex` a propósito. Si la prueba en vivo de la home mostrara el
   `<main id="app">` vacío, el arreglo es poner texto estático (sin precios) dentro de ese `<main>` que el
   JavaScript reemplaza al cargar.

   Pendiente: apuntar el botón de **Reservas del Perfil de Empresa** a **`https://cdavalledupar.com/agendar`**
   (T082) y esperar. Si el sitio deja de abrir, no es de Search Console: ver el aviso de la suspensión por WHOIS.

7. **Listado de citas del panel — RESUELTO (067, 2026-10-01).** `GET /api/citas` devolvía las 200 citas más
   VIEJAS al pasar el tope y Reservas dejaba de mostrar las próximas y los comprobantes por verificar, sin
   aviso. Ahora el servidor ordena de la más nueva a la más vieja (`order by fecha desc, hora desc`), el panel
   pide 500 (`TOPE_DE_CITAS`), da vuelta las próximas para leerlas de la más cercana a la más lejana, y Reservas
   y Vehículos **avisan cuando se llega al tope**. `repositorioCitasPostgres.test.ts` fija el orden del SQL, y
   se comprobó que falla con el orden viejo. **Límite que queda:** con más de 500 citas se cae lo más antiguo;
   la solución completa sería paginar o filtrar por fechas. **Reservas ya tiene filtro y contador de pagos
   (071):** fichas "Comprobante por verificar" y "Sin comprobante" con su número, y un número rojo al lado de
   "Reservas" en el menú del panel. Cuentan sobre las citas cargadas (hasta 500) y no cuentan las canceladas; la
   insignia del menú solo se ve mientras se está en Reservas, Vehículos o Reportes, porque el panel suelta las citas
   al salir de esas secciones.

8. **Deuda que dejó el pago en línea, y no es grave pero conviene saberla.**

   - **Borrar una cita borra también su comprobante — RESUELTO (071).** `borrar()` devuelve la ruta del archivo
     (`rutaDelComprobante`) y la ruta lo quita del bucket **después** de la fila (`borrarComprobante` en
     `almacenamiento/comprobantes.ts`, que solo acepta rutas `citas/<uuid>.<ext>`). Si el archivo no se puede
     quitar, la cita se borra igual y se registra el id de la cita. **Los huérfanos de antes de 071 siguen ahí**
     (los de las citas de prueba): se limpian a mano en Supabase → Storage → `comprobantes/citas/`.
   - **Horarios por día: RESUELTO (069)**, ver el punto 2.
   - **Tres de las cuatro tarjetas del inicio se ven blandas en tablet.** Miden 336–501 px y
     la ranura pide 852 cuando la grilla pasa a una columna. La de "Resultados en Minutos" ya
     se arregló yendo a 900 px: las otras tres se arreglan igual, con fotos del `.rar` de la
     sesión del CDA.
   - **Los tres pasos del proceso siguen en Unsplash** (`pages/home.js`). Mientras estén,
     `images.unsplash.com` no se puede sacar del CSP —ni del `<meta>` de `index.html` ni de
     `server.js`—. Es el último resto de fotos de archivo del sitio.

9. **Retirar el volumen de Railway** (T050). Conservarlo al menos una semana después de la
   mudanza; la implementación en archivo ya se retiró.
10. **Verificar la transferencia internacional de datos bajo la Ley 1581** (T054). La base
   está en Virginia y guarda datos personales de clientes colombianos. No bloquea nada, pero
   si la respuesta es adversa el remedio es migrar la base entera: la región de un proyecto
   de Supabase no se cambia.

> ⚠️ **La conexión a Postgres verifica contra una raíz fijada en el código**
> (`Backend/src/basedatos/certificadoSupabase.ts`), que **vence el 26 de abril de 2031**. Es
> lo correcto —falla cerrado— y tiene un precio: si Supabase rota su CA, el API deja de
> conectar y no hay agendamiento. El síntoma es un error de TLS que no menciona nada de
> esto. **Si el API deja de conectar sin que nadie haya tocado el código, empezá por acá:**
> `cd Backend && npx tsx scripts/verificar-tls.ts`

> ⚠️ **SUPABASE PAUSA LA BASE POR INACTIVIDAD, Y YA PASÓ** (2026-10-06). El plan gratuito pausa el
> proyecto tras unos días sin actividad. El API siguió vivo —`/api/health` daba 200— pero **toda consulta a
> la base daba 503** y nadie podía agendar. `/api/health` NO sirve para detectarlo: no toca la base.
>
> **Cómo se reconoce:** `GET /api/citas/disponibilidad?fecha=<hoy>` responde 503 con "No pudimos consultar los
> cupos", y en los logs de Railway (CDAweb → Deploy Logs) aparece
> `PostgresError: (ENOTFOUND) tenant/user postgres.<ref> not found`. No es de código ni de credenciales.
>
> **Se arregla** con **Restore project** en el panel de Supabase (proyecto "Database CDAvalledupar"); el API se
> recupera solo en unos minutos, porque la cadena de conexión no cambia.
>
> **Cómo se previene:** `.github/workflows/mantener-base-activa.yml` consulta ese mismo endpoint cada 2 días
> —una consulta real a Postgres— y, si el API no responde 200, GitHub manda un correo. No reactiva un proyecto
> ya pausado, avisa con hasta 2 días de retraso, y GitHub desactiva los workflows programados tras 60 días sin
> actividad en el repositorio. La solución definitiva es el plan de pago de Supabase.
>
> OJO al probar a mano: el limitador público (20 peticiones cada 15 minutos por dirección) también cuenta
> `GET /api/citas/disponibilidad`. Un 429 ahí es el limitador, no una caída.

## Convenciones

- **Todo el texto visible y los mensajes de error, en español**, tuteando al usuario.
  Comentarios en español también.
- TypeScript estricto en el backend; nada de `any` sin justificación escrita.
- El backend valida con `npx tsc --noEmit` y `npm test`. El frontend no tiene tests ni
  build: **se valida en el navegador**, y no hay atajo.
- El trabajo se delega a los agentes de `.claude/agents/` según el dominio. Una tarea que
  cruce front y back se reparte, no se resuelve mezclada.
