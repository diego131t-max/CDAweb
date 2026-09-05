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

1. **Verificación en navegador real.** El principio IV la exige y prohíbe simularla, y es lo
   único que separa a la función de pagos de estar terminada. Contra producción ya se
   verificó por HTTP todo el camino público —crear cita, subir comprobante, los rechazos, el
   preflight de CORS, y que el servidor ignore un precio mandado por el cliente—, pero **eso
   no cubre el navegador**. Falta:

   - abrir un comprobante desde el panel y marcar el pago verificado;
   - **agendar con QR subiendo una foto desde el navegador de verdad**: el `<input
     type=file>` y el reescalado por `<canvas>` no los probó nadie;
   - escanear el QR publicado con la app de Bancolombia;
   - mirar `/tarifas` ahora que se llena desde el API.

   **Y borrar las citas de prueba que quedaron en producción**, todas con fecha 2099 para no
   quitarle cupo a nadie: `PRB080` (×2), `PRB090`, `PRB100`, `VAL001`, `VAL002`, `VAL003` y la
   vieja `CUP001`. Se borran desde el panel: cancelar y después borrar. `PRB090` es la que
   tiene comprobante, así que sirve para probar el botón antes de eliminarla.

   Lo de antes sigue valiendo: agendamiento, panel y caminos de fallo (T025, T030, T042),
   borrado (T057), formularios con campo trampa (T060), aspecto después del WebP (T063) y las
   rutas reales de la 009 (T081).
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

   **Pendiente conocido:** las diez franjas valen para todos los días, así que un sábado se
   puede agendar a las 17:00 aunque el sitio publique cierre a las 4, y un festivo también.
   Resolverlo exige el calendario de festivos de Colombia, que se mueve cada año y no se
   puede inventar.

   **La cita `CUP001` que quedó en producción** se creó acá, para verificar que la
   transacción funciona contra Supabase de verdad —lo único que las pruebas no pueden
   cubrir—. Está en la lista de borrado del punto 1, junto con las que dejaron las
   verificaciones del pago en línea.

   **Los medios de pago se ratificaron dos veces.** Primero los presenciales (2026-08-22):
   efectivo y tarjeta por datáfono, los dos al llegar al CDA. El formulario ofrecía "PayU",
   "MercadoPago", "Efectivo" y "Transferencia Bancaria", con **"PayU" como valor por
   omisión**: toda cita en la que el cliente no tocara el desplegable quedó guardada con una
   pasarela que el CDA nunca tuvo. Falta confirmar **qué franquicias acepta el datáfono**:
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
   - **Pendiente de dato del negocio:** el **nombre legal completo del titular** de la
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
   después verificar que el correo llegue a bandeja de entrada y no a spam (T048). El
   propietario decidió esperar; prenderlo es poner las dos variables.
5. **Dos credenciales sin rotar, las dos por decisión explícita del propietario.**

   **La contraseña de Postgres.** El `ADMIN_TOKEN` ya se rotó (2026-08-15); esta no. Es
   corta y adivinable, y el endpoint se alcanza desde internet: hoy lo que protege los datos
   es que el esquema `cda` está fuera de `public` y que RLS está activo sin políticas. Son
   dos capas reales, pero ninguna de las dos es la contraseña.

   **La clave secreta de Supabase Storage** (`SUPABASE_SERVICE_ROLE_KEY`, 2026-08-24).
   Quedó visible en una captura durante la configuración, así que **está quemada**: una
   credencial que pasó por un chat ya no es secreta. Se decidió dejarla. Lo que hay que
   saber: **es la clave que se salta RLS**, o sea que con ella se llega a la tabla de citas
   entera, no solo al bucket de comprobantes. Rotarla son dos minutos y no rompe nada —
   crear una nueva en Settings → API Keys → Secret keys, pegarla en Railway, y recién
   entonces revocar la vieja, en ese orden.
6. **Registrar el sitio en Search Console** (T074): verificar el dominio **con la etiqueta
   HTML, no por DNS**, mandar el sitemap y solicitar la indexación. Ya no está bloqueado: la
   008 se desplegó hace tiempo y la etiqueta está publicada. Lo que sí lo bloquea de hecho es
   que el dominio esté resolviendo —ver el aviso de la suspensión por WHOIS más arriba—.

   Y apuntar el botón de Reservas del Perfil de Empresa a **`/agendar`** (T082). Eso también
   se destrabó con la 009: el `#/agendar` de antes era lo único que funcionaba cuando el
   sitio enrutaba por fragmento, y hoy ya no.
7. **El listado de citas del panel devuelve las MÁS VIEJAS cuando hay más de 200.**
   `GET /api/citas` ordena `fecha asc` con tope de 200, así que apenas la tabla pase ese
   número, Reservas va a mostrar las doscientas citas más antiguas y ninguna de las
   próximas —sin ningún aviso—. Con el tope de 40 vehículos por día, **son cinco días de
   agenda llena**.

   Reportes ya no depende de eso: desde la 039 sus números salen de
   `GET /api/citas/resumen`, que cuenta en la base sobre el rango completo. El que queda
   expuesto es el listado de Reservas. El arreglo es ordenar descendente y dar vuelta la
   lista del lado del cliente, o paginar; toca `repositorioCitasPostgres.listar()` y el
   orden que espera `reservationsTable`.

   **Ahora pesa más que antes**: es la única pantalla donde se ven los comprobantes que
   esperan verificación, así que cuando la tabla pase las 200 filas también van a dejar de
   verse los pagos por revisar. Es el bug más serio que queda abierto.

   Y de paso, no hay contador ni filtro de "pendientes de pago": con 40 vehículos por día,
   encontrarlos a ojo entre la lista es trabajo real. Mensajes sí tiene su insignia de
   nuevos; Reservas no tiene nada equivalente.

8. **Deuda que dejó el pago en línea, y no es grave pero conviene saberla.**

   - **Borrar una cita NO borra su comprobante** del bucket. Quedan objetos huérfanos en
     `comprobantes/citas/`. No le hacen daño a nadie —el bucket es privado y la ruta solo la
     conocía esa fila— pero se acumulan. El arreglo es leer `comprobante_ruta` antes del
     `delete` y pedirle a Storage que lo borre.
   - **Los horarios no distinguen sábados ni festivos.** Las diez franjas valen para todos
     los días, así que se puede agendar un sábado a las 17:00 aunque el sitio publique cierre
     a las 4. Resolverlo exige el calendario de festivos de Colombia, que se mueve cada año y
     **no se puede inventar** (principio I).
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

## Convenciones

- **Todo el texto visible y los mensajes de error, en español**, tuteando al usuario.
  Comentarios en español también.
- TypeScript estricto en el backend; nada de `any` sin justificación escrita.
- El backend valida con `npx tsc --noEmit` y `npm test`. El frontend no tiene tests ni
  build: **se valida en el navegador**, y no hay atajo.
- El trabajo se delega a los agentes de `.claude/agents/` según el dominio. Una tarea que
  cruce front y back se reparte, no se resuelve mezclada.
